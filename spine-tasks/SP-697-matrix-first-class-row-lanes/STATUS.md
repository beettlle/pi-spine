# SP-697: First-class matrix row lane competitors (schedule core) — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-03
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm nested parent-held fan-out + SP-690 throttle
- [ ] Confirm #224 hook path to preserve

---

### Step 1: Schedule matrix rows as lane-pool competitors
**Status:** ⬜ Not Started

- [ ] Rows compete for global maxParallel on distinct lanes
- [ ] Preserve per-row worktreeSetupHook
- [ ] Do not touch buildPlan propagation

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Distinct-lane + global cap regressions
- [ ] Scoped + FULL suite + coverage green

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] `.DONE` created

---

## Blockers

None

## Notes

Partial #228 — aggregation/docs in SP-698; planner virtual rows in SP-696.
