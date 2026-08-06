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
**Status:** 🔵 In Progress

- [ ] Rows compete for global maxParallel on distinct lanes — design: global lane-slot pool (WeakMap keyed by batch state, sized `lanes.maxParallel`); non-matrix tasks hold one slot for their duration; matrix parent holds NO slot during the sweep; each row acquires a slot (waits when pool exhausted) and uses the slot number as its `laneNumber` for worktree/branch naming
- [ ] Preserve per-row worktreeSetupHook
- [ ] Do not touch buildPlan propagation

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Distinct-lane + global cap regressions
- [ ] Scoped + FULL suite + coverage green

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
