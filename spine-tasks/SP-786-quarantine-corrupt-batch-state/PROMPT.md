# Task: SP-786 — Quarantine corrupt batch-state instead of deleting it

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Batch start and complete/dismiss clear paths; a wrong change can block every batch start or let two engines run.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** When the active `batch-state.json` fails to parse, `clearStaleTerminalBatchStateForStart` and `clearActiveBatchStateIfMatches` delete it — before any owner-PID or journal check, without the batch-state lock. `resolveBatchStatePath` falls back to `.pi/batch-state.json`, so a corrupt Taskplane-owned file is deleted too. `--skip-preflight` and internal sequence/detached starts bypass the only preflight guard, so a second batch can start while the original engine is alive.

## Mission

Closes #303 — Corrupt batch-state is quarantined (never deleted), batch start refuses with an actionable message, `.pi/batch-state.json` is never modified by spine, and both clear operations run under the batch-state lock.

1. **Quarantine, don't unlink** (`src/batch/batch-state-io.mjs`): in both corrupt-parse branches, rename the file to `batch-state.corrupt-<UTC timestamp>.json` in the same directory (collision-safe) and return `{ cleared: false, reason: "corrupt", quarantinedPath }`.
2. **Fail closed at start** — `assertNoActiveBatch` (`src/batch/state.mjs`) throws when the clear step reports `reason: "corrupt"`: `Batch state was corrupt and has been quarantined to <path>. Inspect it and the journal (spine status --diagnose), then run spine batch dismiss --force before starting a new batch.` This holds even with `skipPreflight: true` (the engine calls `assertNoActiveBatch` unconditionally at `engine.mjs:98` — confirm).
3. **Spine-owned path only** — start and clear paths act on `.spine/batch-state.json` only. When only `.pi/batch-state.json` exists, never rename or unlink it (return `{ cleared: false, reason: "foreign_state" }`); a corrupt `.pi` file is reported, not modified.
4. **Lock** — run both functions' read-check-mutate under `withBatchStateLock(projectRoot, …)` (re-entrant per process). `clearActiveBatchStateIfMatches` currently takes only a path; add a `projectRoot` parameter (derive from the `.spine` parent if needed) and update `clearCompletedBatchState` in `src/batch/lifecycle-archive.mjs` accordingly.
5. **Tests** in `tests/batch/batch-state-handoff.test.mjs`: corrupt `.spine` state → quarantined, not deleted, for both functions; corrupt `.pi` state → untouched; terminal `.pi` state → untouched; batch start with corrupt state and `skipPreflight: true` refuses with the actionable message.

## Dependencies

- **None**

## Context to Read First

- `src/batch/batch-state-io.mjs` — `resolveBatchStatePath` (~line 27), `clearActiveBatchStateIfMatches` (~line 137), `clearStaleTerminalBatchStateForStart` (~line 166)
- `src/batch/state.mjs` — `assertNoActiveBatch` (~line 130)
- `src/batch/lifecycle-archive.mjs` — `clearCompletedBatchState` (~line 44); callers in `src/batch/lifecycle.mjs` (~lines 250, 456)
- `src/batch/batch-state-lock.mjs` — `withBatchStateLock` contract (header comment)
- `src/config/preflight/git-batch.mjs` ~line 233 — existing preflight parse-error guard (message style)
- GitHub #303 (related #296 / SP-780, #301)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/batch-state-io.mjs`
- `src/batch/state.mjs`
- `src/batch/lifecycle-archive.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/batch-state-handoff.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-state-handoff.test.mjs tests/batch/batch-state-lock.test.mjs` |
| fileScopeMustChange | `src/batch/batch-state-io.mjs`, `tests/batch/batch-state-handoff.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce the three deletions from #303 in a temp project
- [ ] `rg -n "clearActiveBatchStateIfMatches|clearStaleTerminalBatchStateForStart|clearCompletedBatchState" src tests` — list callers and tests
- [ ] Confirm `engine.mjs` calls `assertNoActiveBatch` regardless of `skipPreflight`
- [ ] Dependencies satisfied

### Step 1: Quarantine + spine-only path + lock

- [ ] Corrupt branches rename to `batch-state.corrupt-<ts>.json`; return `quarantinedPath`
- [ ] Start/clear act on `.spine/batch-state.json` only; `.pi` never modified
- [ ] Both functions run under `withBatchStateLock`; `projectRoot` threaded through `clearCompletedBatchState`
- [ ] `lifecycle.mjs` stays ≤ 500 lines

**Artifacts:**
- `src/batch/batch-state-io.mjs`, `src/batch/lifecycle-archive.mjs`, `src/batch/lifecycle.mjs` (modified)

### Step 2: Fail-closed start

- [ ] `assertNoActiveBatch` throws the actionable quarantine message on `reason: "corrupt"`
- [ ] Holds with `skipPreflight: true`

**Artifacts:**
- `src/batch/state.mjs` (modified)

### Step 3: Tests

- [ ] Corrupt `.spine` → quarantined (both functions)
- [ ] Corrupt and terminal `.pi` → untouched
- [ ] Start with corrupt state + `skipPreflight: true` refuses

**Artifacts:**
- `tests/batch/batch-state-handoff.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 documents the quarantine recovery flow)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §6 Resume, dismiss, complete

## Completion Criteria

- [ ] Corrupt state is quarantined, never deleted
- [ ] Batch start refuses with an actionable message, even with `--skip-preflight`
- [ ] `.pi/batch-state.json` never modified by spine start/clear
- [ ] Clear operations lock-protected
- [ ] Closes #303

## Git Commit Convention

- `fix(SP-786): quarantine corrupt batch-state and fail closed at start (#303)`

## Do NOT

- Reconstruct state from the journal automatically (follow-up)
- Add a new `spine state repair` command in this task
- Change batch-state read-modify-write sites outside the two clear functions (#301)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
