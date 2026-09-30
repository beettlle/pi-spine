# SP-791: Atomic batch-state read-modify-write helper — Status

**Current Step:** Step 3
**Status:** 🟨 In Progress
**Last Updated:** 2026-09-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-790 landed (`allowArchivedResurrection` present in `src/batch/state-io.mjs`; integrated in `92a53711`)
- [x] Callers listed (`rg -n "saveEngineBatchState|enforceOperatorPauseOnDisk|mergeEngineStateWithDiskPause" src tests`): `saveEngineBatchState` called from `engine.mjs` (7), `engine-lanes.mjs` (8), `engine-lanes/matrix-run.mjs` (5), `pause.mjs` `adoptPauseIfRequested`, 3 tests; `enforceOperatorPauseOnDisk` from `attached-runner-promote.mjs:223` + 1 test; `mergeEngineStateWithDiskPause` from `saveEngineBatchState`, `adoptPauseIfRequested`, 1 test.
- [x] Dependencies satisfied

### Step 1: `updateSpineBatchState`
**Status:** ✅ Complete

- [x] Single-lock RMW with structured result (`missing` / `corrupt` / no-op / guard-rejected / persisted)
- [x] Shared guard/write path (private `persistSpineBatchStateGuarded`; `saveSpineBatchState` delegates to it)
- [x] `state-io.mjs` ≤ 500 lines (now 327; also one-line re-export added to `src/batch/state.mjs` facade, see Discoveries)

### Step 2: Engine + pause paths
**Status:** ✅ Complete

- [x] Engine merge inside lock (`saveEngineBatchState` wraps merge+save in one hold; nested save re-enters)
- [x] Pause via helper (`enforceOperatorPauseOnDisk` + `pauseBatch` initial write; initial write re-checks disk phase under the lock)
- [x] Rollback respects terminal phase (restores `fromPhase` only while disk phase is still `paused`; journals `batch.pause_failed` with pre-rollback `observedPhase`)

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Two-process RMW
- [ ] Rollback-vs-terminal
- [ ] Helper unit cases

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Added a one-line re-export of `updateSpineBatchState` to `src/batch/state.mjs` (facade `pause.mjs` already imports from) — logically-required import forwarding, outside the listed File Scope. |
| 2 | `withBatchStateLock` is typed `() => unknown`, so `updateSpineBatchState` uses an expression-level JSDoc cast for its structured result (batch tsconfig `checkJs`). |
| 3 | `pauseBatch` phase pre-check still runs on a pre-lock load; the authoritative re-check happens inside `updateSpineBatchState`, so a terminal phase landing in between now yields `cannot_pause` with the observed phase instead of being overwritten. |
| 4 | `enforceOperatorPauseOnDisk` returns `false` when the guarded write is refused (previously `true` after a silently-dropped save); today the only reachable refusal paths (missing/corrupt) already returned `false`. |
## Blockers

_None._
