# SP-695: Engine-owned plan review phase after worker .DONE — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-08-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm plan required for RL≥1 but no engine plan phase
- [x] Confirm resume path mirrors the gap

---

### Step 1: Add runPlanReviewPhase and wire callers
**Status:** ✅ Complete

- [x] Implement + export `runPlanReviewPhase`
- [x] Wire `engine-lanes.mjs` and `resume-lane-reviews.mjs` before code/final
- [x] Align skip/runbook messaging

---

### Step 2: Testing & Verification
**Status:** 🟡 In Progress

- [x] Plan-phase regressions for success + resume
- [x] Scoped contract command green (27/27, incl. final-review-honor + final-verdict)
- [x] Fixed 5 known failures: scoped final verdict assertions to `reviewType === "final"` (plan phase now journals its own APPROVE verdict first)
- [ ] FULL suite + coverage gate green (running)

---

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Runbook updated
- [ ] `.DONE` created

---

## Blockers

None

## Notes

Release v2.12.3 Wave 1 — disjoint from matrix tasks except shared `engine-lanes.mjs` (serialize waves).

Retry 3 (2026-08-05): Amendment root cause confirmed — the 5 failures were assertion-order issues, not verdict-queue consumption. Plan stub verdicts come from their own env (`SPINE_ENGINE_PLAN_STUB_VERDICT(S)`, default APPROVE); the plan phase journals `task.verdict_recorded` with `reviewType: "plan"` before the final phase, so `events.find(...)` in final tests matched the plan event. Fix: filter final-review assertions by `payload?.reviewType === "final"` (plan phase not weakened).
