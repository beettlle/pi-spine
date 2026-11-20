# SP-874: Step-0 plan review spawn ordering before later-step plan reviews — Status

**Current Step:** Step 1 — Ordering fix
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map where step-0 vs later plan reviews are spawned
- [x] GitNexus impact on runPlanReviewPhase

---

### Step 1: Ordering fix
**Status:** ⬜ Not Started

- [ ] Schedule step-0 plan review before later-step plan reviews
- [ ] Preserve fail-closed spawn failure paths

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Assert step 0 is first when multiple plan reviews are queued

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
- [ ] Create .DONE

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Step-0 vs later-step plan review spawn sites mapped: engine post-.DONE plan phase (`runPlanReviewPhase` → `runEnginePlanReview` → `runStepReview` spawn) targets `findPlanReviewStepNumber` = first `plan-review checkpoint` marker step, else min step. Packets with a checkpoint at step N>0 queue ONLY the later-step review — step 0 is silently dropped (mission item 2 violation). | Fix in Step 1 | `src/batch/engine-lanes/review-plan.mjs` |
| Later-step plan verdicts enter the journal pre-phase via worker `spine_review_step` stub checkpoint reviews (stub batches); the phase-level honor scan accepts ANY plan `review.completed` for the task regardless of `payload.stepNumber`, so a later-step verdict can satisfy the gate while step 0 is unreviewed. | Step filtering added in Step 1 | `findCompletedPlanReview` |
| GitNexus index (pi-spine, indexed 2026-11-19T20:33 @885544be) does NOT contain `runPlanReviewPhase`/`runEnginePlanReview` — MCP + CLI impact both returned not-found (risk: UNKNOWN per AGENTS.md standing order). Confirmed callers via text search: `engine-lanes.mjs:392` (runNonMatrixTaskOnLane), `resume-lane-reviews.mjs:17` (← `resume.mjs:317`, `resume-multi-lanes.mjs:66,359`), facade re-exports only; matrix-run.mjs has no direct plan-phase call. All callers check only `.ok`. | Index gap documented; text-search confirmation per AGENTS.md UNKNOWN rule | `.gitnexus/meta.json`, grep |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-20 | Step 0 preflight | Spawn sites mapped; GitNexus impact UNKNOWN (symbol absent from index) → text-search caller confirmation done; blast radius LOW-MED (3 call sites, `.ok`-only contracts) |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
