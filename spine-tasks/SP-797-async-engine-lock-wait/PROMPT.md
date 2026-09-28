# Task: SP-797 — Engine batch-state saves wait for the lock without blocking the event loop

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Converts ~19 engine save call sites to `await`; a missed `await` or a sync caller breaks engine progress persistence.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** `withBatchStateLock` waits with `sleepSync` (`Atomics.wait`, `src/batch/batch-state-lock.mjs` ~98) polling every 25 ms up to 30 s. When the engine contends with a CLI holder, the engine's single event loop freezes: other lanes' heartbeats, worker pipe draining and stall timers stop. CLI callers are synchronous and may keep blocking; engine callers are async and should not.

## Mission

Closes #302 — Engine saves wait for the lock asynchronously; CLI callers keep the synchronous API.

1. **`withBatchStateLockAsync(projectRoot, fn, options)`** in `batch-state-lock.mjs`: same acquire loop as the sync version (reuse `tryCreateLockFile`, `breakStaleLock` from SP-794, token release, re-entrancy map), but waits with `await setTimeout(POLL_INTERVAL_MS)` from `node:timers/promises`. **`fn` stays synchronous** and runs without any `await` between acquire and release, so the per-process re-entrancy map stays correct (no other same-process code can run while the lock is held). If the lock is already held by this process, run `fn` directly. Journal-free: return `{ result, waitedMs }` internally, and log one `[spine]` stderr line when `waitedMs` exceeds 1 000 ms.
2. **Async engine save**: `saveEngineBatchState` (`src/batch/pause.mjs`) becomes `async` and uses `withBatchStateLockAsync` around the in-lock merge + save from SP-791 (the nested `saveSpineBatchState` call re-enters synchronously). Keep a synchronous path for non-engine callers only if Step 0 finds any (record them).
3. **Await every engine call site**: `src/batch/engine.mjs`, `src/batch/engine-lanes.mjs`, `src/batch/engine-lanes/matrix-run.mjs`, and `adoptPauseIfRequested` in `pause.mjs` (becomes async; update its callers). Step 0 must confirm each enclosing function is already `async`; if a call site sits in a synchronous function, make that function async only when all its callers are async — otherwise stop and record it as a blocker.
4. **Tests**: `tests/batch/batch-state-lock-async.test.mjs` — a child process holds the lock for ~500 ms; the test awaits `withBatchStateLockAsync` while a `setInterval` counter runs; assert the counter advanced ≥ 5 times during the wait and the write landed. Re-entrancy case: nested sync `withBatchStateLock` inside `fn` runs directly. Update existing tests that call `saveEngineBatchState` / `adoptPauseIfRequested` to `await`.

## Dependencies

- **Task:** SP-794 (steal-by-rename in the shared acquire loop)
- **Task:** SP-791 (`saveEngineBatchState` in-lock merge)
- **Task:** SP-793 (`bypassOwnerCheck` rename in `pause.mjs` / `state-io.mjs`)

## Context to Read First

- GitHub #302 (defect 2 and proposed solution step 3)
- `src/batch/batch-state-lock.mjs` — full file (re-entrancy map comments explain the constraints)
- `src/batch/pause.mjs` — `saveEngineBatchState`, `adoptPauseIfRequested`
- `rg -n "saveEngineBatchState\(|adoptPauseIfRequested\(" src tests`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/batch-state-lock.mjs`
- `src/batch/pause.mjs`
- `src/batch/engine.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/engine-lanes/matrix-run.mjs`
- `tests/batch/batch-state-lock-async.test.mjs`
- `tests/batch/pause-phase-persistence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-state-lock-async.test.mjs tests/batch/batch-state-lock.test.mjs tests/batch/batch-state-update.test.mjs tests/batch/pause-phase-persistence.test.mjs tests/batch/pause-retry-guard.test.mjs tests/batch/engine.test.mjs` |
| fileScopeMustChange | `src/batch/batch-state-lock.mjs`, `src/batch/pause.mjs`, `tests/batch/batch-state-lock-async.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-791 and SP-794 landed
- [ ] List every `saveEngineBatchState` / `adoptPauseIfRequested` call site with its enclosing function and whether it is `async`
- [ ] `rg -l "saveEngineBatchState|adoptPauseIfRequested" tests` — tests to update (add any beyond File Scope to STATUS Discoveries)
- [ ] `ls tests/batch/engine.test.mjs` — if absent, replace it in the Contract run with the engine test file Step 0 finds, and log it
- [ ] Dependencies satisfied

### Step 1: Async acquire

- [ ] `withBatchStateLockAsync` with async wait, sync `fn`, re-entrancy pass-through
- [ ] Long-wait stderr line

**Artifacts:**
- `src/batch/batch-state-lock.mjs` (modified)

### Step 2: Async engine save + call sites

- [ ] `saveEngineBatchState` and `adoptPauseIfRequested` async
- [ ] Every engine call site awaited

**Artifacts:**
- `src/batch/pause.mjs`, `src/batch/engine.mjs`, `src/batch/engine-lanes.mjs`, `src/batch/engine-lanes/matrix-run.mjs` (modified)

### Step 3: Tests

- [ ] Event loop keeps running during contended wait
- [ ] Re-entrancy case
- [ ] Existing tests awaited

**Artifacts:**
- `tests/batch/batch-state-lock-async.test.mjs` (new), existing tests (modified)

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
- None

## Completion Criteria

- [ ] A heartbeat-style timer keeps firing while the engine waits for a contended lock
- [ ] CLI callers keep the synchronous `withBatchStateLock`
- [ ] Closes #302 (with SP-794, SP-795, SP-796 on `main`)

## Git Commit Convention

- `fix(SP-797): async batch-state lock wait for engine saves (#302)`

## Do NOT

- Put an `await` inside the locked section
- Convert CLI (operator) callers to async
- Change stale-break logic (SP-794) or `writeJsonAtomic` (SP-795)
- Change contract verification (SP-800)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
