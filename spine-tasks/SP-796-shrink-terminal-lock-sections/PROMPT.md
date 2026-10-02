# Task: SP-796 — Hold the batch-state lock only for state I/O in abort, complete and dismiss

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Terminal operations; moving cleanup out of the lock changes ordering between state clear, worker kill and worktree removal.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** Terminal sections do heavy work while holding the global lock: `abortBatch` (`src/batch/abort.mjs` ~226-300) kills lane workers, writes an fsync'd archive, reads the whole journal, appends history and removes lane worktrees; `dismissBatch` / `completeBatch` (`src/batch/lifecycle.mjs` lock sections) write post-mortems and metrics and run `cleanupBatchLaneWorktrees`. Other writers (engine saves) block for up to 30 s (`DEFAULT_TIMEOUT_MS`) and then throw.

## Mission

Partial #302 — Abort, complete and dismiss hold the lock only for state-file I/O (archive write, history append, active-state clear); worker termination, post-mortem/metrics and worktree cleanup run after release.

1. **Abort**: inside the lock keep only: in-lock reload (from SP-792), archive write, history append, active-state clear, and the `batch.aborted` journal event. After the lock is released: `killLaneWorkers`, `removeLaneWorktrees`, and other cleanup. Cleanup runs only when the in-lock section succeeded (journaled `batch.aborted`).
2. **Dismiss and complete**: same split — post-mortem, metrics and `cleanupBatchLaneWorktrees` move after release, gated on the in-lock section having archived and journaled `batch.completed` / dismiss event.
3. **Errors after release** are reported in the result (`cleanupWarnings: string[]`) and journaled (`batch.cleanup_failed` `{ step, error }`), never thrown after the state was already archived.
4. **Tests**: in `tests/batch/abort.test.mjs` and `tests/batch/lifecycle.test.mjs`, spy on `withBatchStateLock`'s section (or check lock-file presence from inside injected cleanup hooks) to assert the lock is **not** held while worker kill / worktree cleanup run; a cleanup failure yields `cleanupWarnings` + `batch.cleanup_failed` with state still archived.

## Dependencies

- **Task:** SP-792 (in-lock reload in the same abort/lifecycle sections)

## Context to Read First

- GitHub #302 (defect 2 and proposed solution step 2)
- SP-792 changes in `src/batch/abort.mjs` and `src/batch/lifecycle.mjs`
- `src/batch/lifecycle-archive.mjs` — `archiveBatchState`, `clearCompletedBatchState`
- `src/batch/batch-state-lock.mjs` — header (lock ordering)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/abort.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/lifecycle-cleanup.mjs`
- `tests/batch/abort.test.mjs`
- `tests/batch/lifecycle.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/abort.test.mjs tests/batch/lifecycle.test.mjs tests/batch/batch-state-handoff.test.mjs tests/batch/batch-state-lock.test.mjs` |
| fileScopeMustChange | `src/batch/abort.mjs`, `src/batch/lifecycle.mjs` |

## Steps

### Step 0: Preflight

- [ ] List every operation inside each terminal lock section; classify state-I/O vs cleanup
- [ ] Confirm SP-792 landed
- [ ] Dependencies satisfied

### Step 1: Abort split

- [ ] Lock holds state I/O + `batch.aborted` only
- [ ] Kill + worktree cleanup after release, gated on success

**Artifacts:**
- `src/batch/abort.mjs` (modified)

### Step 2: Complete + dismiss split

- [ ] Post-mortem, metrics, worktree cleanup after release
- [ ] `cleanupWarnings` + `batch.cleanup_failed` on post-release errors
- [ ] `lifecycle.mjs` stays ≤ 500 lines

**Artifacts:**
- `src/batch/lifecycle.mjs` (modified)

### Step 3: Tests

- [ ] Lock not held during cleanup (abort, complete, dismiss)
- [ ] Cleanup failure reported, state archived

**Artifacts:**
- `tests/batch/abort.test.mjs`, `tests/batch/lifecycle.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §6 Pause and abort

## Completion Criteria

- [ ] Abort/complete/dismiss hold the lock only for state I/O
- [ ] Post-release cleanup errors are reported, not thrown

## Git Commit Convention

- `fix(SP-796): shrink terminal batch-state lock sections to state I/O (#302)`

## Do NOT

- Change lock acquisition (SP-794, SP-797)
- Change which snapshot is archived (SP-792 owns that)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-09-28: Contract `testCommand` sets `SPINE_SUPPRESS_JOURNAL_ATTACH=1` so tests run by the worker cannot write into the live batch journal (#328).
- 2026-10-02: `lifecycle.mjs` is at 494/500 lines after SP-792. If the split would push it over 500, move the post-release cleanup (post-mortem, metrics, worktree cleanup, `cleanupWarnings` / `batch.cleanup_failed` handling) into a new `src/batch/lifecycle-cleanup.mjs` shared by complete and dismiss (and abort if it fits). Added to File Scope.
