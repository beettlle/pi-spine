# SP-697: First-class matrix row lane competitors (schedule core) — Status

**Current Step:** Step 1 — Schedule matrix rows as lane-pool competitors
**Status:** 🔵 In Progress
**Last Updated:** 2026-08-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm nested parent-held fan-out + SP-690 throttle — `runTaskOnLane` (engine-lanes.mjs) computes `matrixRowConcurrencyLimit(maxParallel, 1)` and `runMatrixTaskOnLane` fans rows out via nested `runConcurrent` on the held parent lane
- [x] Confirm #224 hook path to preserve — `runMatrixSubLaneSetupHook` runs per row worktree in `runMatrixSubLane` before the row command; keep unchanged
- [x] Confirmed tests asserting nested throttle: SP-690 unit tests + mixed-wave E2E asserting throttled `maxParallel: 1` in `matrix.task_started` (to be superseded)

### Step 1: Schedule matrix rows as lane-pool competitors
**Status:** ✅ Complete

- [x] Rows compete for global maxParallel on distinct lanes — lane-slot pool in `matrix.mjs` (WeakMap keyed by batch state, sized `lanes.maxParallel`); non-matrix tasks hold one slot via `runTaskOnLane` wrapper; matrix parent holds NO slot during the sweep; each row acquires a slot and uses it as its `laneNumber`/worktree/branch identity. `matrixRowConcurrencyLimit` (SP-690) removed.
- [x] Preserve per-row worktreeSetupHook — `runMatrixSubLane` hook sequence unchanged; hook E2E green
- [x] Do not touch buildPlan propagation — planner files untouched

### Step 2: Testing & Verification
**Status:** 🔵 In Progress

- [x] Distinct-lane + global cap regressions — scoped suite 28/28 green (new: slot-pool units, distinct-lanes E2E with overlap proof, mixed-wave global-cap E2E via journal interval sweep)
- [ ] Scoped + FULL suite + coverage green — scoped ✅ (`npm run typecheck` + matrix-execution 28/28); FULL suite + coverage pending

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] `.DONE` created

---

## Blockers

None

## Notes

Partial #228 — aggregation/docs in SP-698; planner virtual rows in SP-696.
Real-pi batch: engine runs plan/code/final reviews after `.DONE`; no in-worker review calls.
Impact analysis (gitnexus): `runMatrixTaskOnLane` ← 1 caller (`runTaskOnLane`), `runTaskOnLane` ← engine.mjs tick loop only. LOW risk.
