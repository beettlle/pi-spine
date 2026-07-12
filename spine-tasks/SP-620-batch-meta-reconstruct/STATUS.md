# SP-620: Reconstruct batch state from batch-meta — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-11
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Confirm SP-619 landed
- [x] Trace resume --force missing/corrupt state paths

### Step 1: Reconstruct + wire force-resume

**Status:** ✅ Complete

- [x] Implement reconstruct helper
- [x] Wire resume --force
- [x] Fail-closed errors for missing/ambiguous meta

### Step 2: Testing & Verification

**Status:** 🔄 In Progress

- [x] Incident-style reconstruct tests
- [x] Run contract `testCommand`
- [ ] Full suite + coverage gate ≥77%

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 findings

- SP-619 landed: `spine-tasks/SP-619-batch-meta-persist/.DONE` + `src/batch/batch-meta.mjs`.
- Missing/corrupt path was `no_active_batch` with no reconstruct.

### Step 1 plan (Review Level 2)

Plan review skipped (real-pi nested spawn blocked; engine reviews after `.DONE`).

Implemented:
- `reconstructBatchStateFromRuntime` / `ensureForceResumeBatchState` in `batch-meta.mjs`
- Wired in `validateMultiTaskResume` + `resumeBatch` (journal `batch.state_reconstructed`)
- Fail-closed: missing meta, ambiguous metas, wavePlan conflict, completed

### Step 2

Contract testCommand PASS (7/7). Full suite + coverage pending.

## Discoveries

| Finding | Action |
|---------|--------|
| Write guard blocks ACTIVE-phase resurrection when archive exists | Reconstruct persist uses `bypassWriteGuard: true` |
| Journal rebuild yields running without live engine | Remap running/aborted/planning → failed for force-reconstruct |
| Orch branch required before lane provision in tests | Call `ensureOrchBranch` in resume validate incident test |
