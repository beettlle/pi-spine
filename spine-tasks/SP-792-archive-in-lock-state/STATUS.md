# SP-792: Abort, complete and dismiss archive in-lock state — Status

**Current Step:** Step 3 — Tests
**Status:** 🟨 In Progress
**Last Updated:** 2026-09-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Pre-lock snapshot uses listed
- [x] Line counts noted
- [x] Dependencies satisfied

### Step 1: Abort in-lock reload
**Status:** ✅ Complete

- [x] Reload + mismatch fail-closed
- [x] Snapshot from in-lock state

### Step 2: Complete + dismiss in-lock reload
**Status:** ✅ Complete

- [x] Reload + precondition re-validated
- [x] Archive/history/clear from in-lock state
- [x] `lifecycle.mjs` ≤ 500 lines (494)

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Abort stale-snapshot
- [ ] Complete/dismiss stale-snapshot
- [ ] Batch-id changed

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
| 1 | Pre-lock `loaded.raw` uses inside lock sections: `abort.mjs` — `buildAbortedSnapshot(loaded.raw)` L227, `clearActiveBatchState(loaded.path)` L300; `lifecycle.mjs` dismiss — archive L214, postMortem L217, metric L240, cleanup L247, clear L248; complete — archive L420, postMortem L423, metric L446, cleanup L453, clear L454. Baseline line counts: `lifecycle.mjs` 469/500, `abort.mjs` 301. |
| 2 | `reconcileBatch` is called with in-memory `batchState` (no re-read), so an in-lock reload of the state file is the only fresh read — no double-count risk in tests. |
| 3 | Shared reload helper `reloadStateForTerminalWrite` extracted into `src/batch/lifecycle-archive.mjs` (PROMPT Step 2 permits this to keep `lifecycle.mjs` ≤ 500 lines). File Scope addition per PROMPT. |

## Blockers

_None._
