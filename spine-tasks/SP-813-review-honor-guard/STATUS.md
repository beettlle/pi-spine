# SP-813: Engine never honors foreign stub verdicts — Status

**Current Step:** Step 1: Trust predicate + finders
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Legit stub / relative-path producers listed
- [x] Dependencies satisfied

### Step 1: Trust predicate + finders
**Status:** 🟡 In Progress

- [ ] Predicate
- [ ] Finders + `review.honor_rejected`

### Step 2: Contract before final honor
**Status:** ⬜ Not Started

- [ ] Verify before honor, once per entry

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] #328 reproduction
- [ ] Legit honors preserved
- [ ] Plan/code finders

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact: `honorCompletedReview` LOW (3 direct callers — plan/code/final phases); `findCompletedFinalReview` / `findCompletedCodeReview` LOW (0 indexed upstream; called via callback, `review-step-run.mjs:74`, tests). |
| 2 | `runFinalReviewPhase` impact HIGH — direct callers `runNonMatrixTaskOnLane` (engine-lanes.mjs) and `runLaneReviewPhasesBeforeCommit` (resume-lane-reviews.mjs); processes `markTaskCompleteFromDisk`/`runResumedTaskOnLane`. Mitigation: minimal fast-path change + full batch suite + contract testCommand. |
| 3 | Legit `stub: true` producers that must keep honoring: (a) `honorReviewSpawnFailureWhenEligible` journals `{ stub: true, honored: true, honorReason: "spawn_timeout_with_done" }` in real batches → predicate exempts `payload.honored === true`; (b) `runEnginePlanReview`/`runEngineCodeReview` stub paths journal `{ stub: true }` only when `shouldUseReviewStub()` — covered by stubMode; (c) `runSpineReviewStep` stub path (review-step-run.mjs) same env gate. |
| 4 | `findCompletedPlanReview` is private to review-plan.mjs; tested via `runPlanReviewPhase` (honor via in-folder artifact avoids reviewer spawn). |
| 5 | `isHonorableReviewEvent` defaults `stubMode` to `shouldUseReviewStub(process.env)` so non-editable caller `review-step-run.mjs:74` (SP-814 file) keeps stub-batch behavior without modification. |
| 6 | Journal events carry `eventId` (UUID) + `timestamp` — dedupe `review.honor_rejected` by source `eventId`. |
| 7 | Existing honor fixtures (final-review-honor, review-crash-recovery, engine-code-review) use absolute in-folder artifactPath and no `stub: true` — unaffected by guard. |

## Blockers

_None._
