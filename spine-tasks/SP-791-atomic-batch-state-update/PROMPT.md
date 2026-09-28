# Task: SP-791 — Atomic batch-state read-modify-write helper; engine and pause merge inside the lock

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Engine progress saves and operator pause share this path; a regression can lose operator pauses or engine progress.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `withBatchStateLock` (#264) wraps only the guard and the write in `saveSpineBatchState`. Callers load and mutate state outside the lock, then save a whole snapshot, so operator actions and engine saves clobber each other. `saveEngineBatchState` (`src/batch/pause.mjs` ~69) calls `mergeEngineStateWithDiskPause` (reads disk) *before* taking the lock. `pauseBatch` (~161) loads outside the lock, saves `paused` with bypass, and its rollback (~197-201) sets the phase back unconditionally — it can revert a terminal `completed`/`failed` to `running`. `enforceOperatorPauseOnDisk` (~80) has the same shape.

## Mission

Partial #301 — Add one helper that loads, mutates and saves under a single lock hold, and move the engine/pause paths onto it so operator pause and engine progress both survive.

1. **`updateSpineBatchState(projectRoot, mutate, options)`** in `src/batch/state-io.mjs`: inside one `withBatchStateLock` hold — load; missing file → `{ ok: false, reason: "missing" }`; parse error → `{ ok: false, reason: "corrupt" }`; `structuredClone` the raw state; call `mutate(draft, { diskState })`; if `mutate` returns `false`, return `{ ok: true, changed: false, state: diskState }` without writing; otherwise run the same guard + write path as `saveSpineBatchState` (reuse, do not duplicate) and return `{ ok: true, changed: true, state }`, or `{ ok: false, reason }` when the guard rejects. `options` passes through `bypassWriteGuard` / `allowArchivedResurrection` (from SP-790).
2. **Engine save merges inside the lock** (`pause.mjs` `saveEngineBatchState`): run `mergeEngineStateWithDiskPause` and the save inside one `withBatchStateLock` hold (the lock is re-entrant per process, so the nested `saveSpineBatchState` acquisition is safe). The engine adopts the operator-owned `phase: "paused"` instead of overwriting it.
3. **Pause via the helper** (`pause.mjs`): `enforceOperatorPauseOnDisk` and the initial pause write in `pauseBatch` use `updateSpineBatchState`. Pause **rollback restores `fromPhase` only if the disk phase is still `paused`**; if the disk phase is terminal (`completed`, `failed`, `aborted`, `merge_blocked`), leave it and journal `batch.pause_failed` as today.
4. **Tests**: two-process read-modify-write test (child processes each run 20 `updateSpineBatchState` increments of different fields; both sets of changes survive) in `tests/batch/batch-state-lock.test.mjs`; rollback-vs-terminal case in `tests/batch/pause-phase-persistence.test.mjs`; helper unit cases (missing, corrupt, `mutate` returns false, guard rejection) in `tests/batch/batch-state-update.test.mjs`.

## Dependencies

- **Task:** SP-790 (guard semantics and `allowArchivedResurrection` option in `state-io.mjs`)

## Context to Read First

- GitHub #301 (proposed solution steps 1-3, 6)
- `src/batch/state-io.mjs` — `saveSpineBatchState`, `loadSpineBatchState`
- `src/batch/batch-state-lock.mjs` — `withBatchStateLock` header comment (re-entrancy)
- `src/batch/pause.mjs` — `mergeEngineStateWithDiskPause`, `saveEngineBatchState`, `enforceOperatorPauseOnDisk`, `pauseBatch`
- `tests/batch/batch-state-lock.test.mjs` ~57-77 — existing in-test RMW pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/state-io.mjs`
- `src/batch/pause.mjs`
- `tests/batch/batch-state-update.test.mjs`
- `tests/batch/batch-state-lock.test.mjs`
- `tests/batch/pause-phase-persistence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-state-update.test.mjs tests/batch/batch-state-lock.test.mjs tests/batch/pause-phase-persistence.test.mjs tests/batch/pause-retry-guard.test.mjs tests/batch/batch-state-stale-writer.test.mjs` |
| fileScopeMustChange | `src/batch/state-io.mjs`, `src/batch/pause.mjs`, `tests/batch/batch-state-update.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-790 landed (`allowArchivedResurrection` present in `state-io.mjs`)
- [ ] `rg -n "saveEngineBatchState|enforceOperatorPauseOnDisk|mergeEngineStateWithDiskPause" src tests` — list callers
- [ ] Dependencies satisfied

### Step 1: `updateSpineBatchState`

- [ ] Load + clone + mutate + guarded save in one lock hold; structured result
- [ ] Shares the guard/write code with `saveSpineBatchState` (no duplicated write path)
- [ ] `state-io.mjs` stays ≤ 500 lines

**Artifacts:**
- `src/batch/state-io.mjs` (modified)

### Step 2: Engine + pause paths

- [ ] `saveEngineBatchState` merges disk pause inside the lock
- [ ] `enforceOperatorPauseOnDisk` and `pauseBatch` use the helper
- [ ] Rollback never overwrites a terminal phase

**Artifacts:**
- `src/batch/pause.mjs` (modified)

### Step 3: Tests

- [ ] Two-process RMW: both processes' changes survive
- [ ] Rollback-vs-terminal case
- [ ] Helper unit cases (missing, corrupt, no-op, rejected)

**Artifacts:**
- `tests/batch/batch-state-update.test.mjs` (new), `tests/batch/batch-state-lock.test.mjs`, `tests/batch/pause-phase-persistence.test.mjs` (modified)

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

- [ ] `updateSpineBatchState` exists with structured results
- [ ] Concurrent operator pause and engine save: both changes survive
- [ ] Pause rollback never overwrites a terminal phase

## Git Commit Convention

- `fix(SP-791): atomic batch-state update helper; engine/pause merge under lock (#301)`

## Do NOT

- Change abort or lifecycle complete/dismiss (SP-792)
- Rename `bypassWriteGuard` or migrate gate/retry sites (SP-793)
- Make lock waits async (SP-797)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-09-28: Contract `testCommand` sets `SPINE_SUPPRESS_JOURNAL_ATTACH=1` so tests run by the worker cannot write into the live batch journal (#328).
