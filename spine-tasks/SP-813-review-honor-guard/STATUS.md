# SP-813: Engine never honors foreign stub verdicts — Status

**Current Step:** Step 5: Documentation & Delivery
**Status:** 🟢 Complete (verification passed)
**Last Updated:** 2026-10-09
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Legit stub / relative-path producers listed
- [x] Dependencies satisfied

### Step 1: Trust predicate + finders
**Status:** ✅ Complete

- [x] Predicate
- [x] Finders + `review.honor_rejected`

### Step 2: Contract before final honor
**Status:** ✅ Complete

- [x] Verify before honor, once per entry

### Step 3: Tests
**Status:** ✅ Complete

- [x] #328 reproduction
- [x] Legit honors preserved
- [x] Plan/code finders

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint — `npm run lint` clean (0 warnings)
- [x] Contract `testCommand` — 58/58 pass
- [x] Batch suite — 1635/1637; the 2 failures are pre-existing timing flakes (see Discovery 8)
- [x] Coverage gate — 90.11% line coverage (threshold 77%), 2814/2814 pass
- [x] Fix all failures — fixed phase23-exit LOC-cap failure caused by this task (Discovery 9)

### Step 5: Documentation & Delivery
**Status:** 🟡 In Progress

- [x] Discoveries logged in STATUS.md
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
| 8 | `tests/batch/sequence-detached-poll.test.mjs` has 2 timing-sensitive tests that fail intermittently under full-suite load (`waitForSequenceBatchTerminal hard-caps…`, `…reused PID`). Reproduced on unmodified `main` (1626/1628, same 2 failures) → pre-existing flake, unrelated to SP-813. They pass in isolation and passed in the coverage suite run (2814/2814). |
| 9 | The SP-813 additions pushed `src/batch/review-artifacts.mjs` to 534 lines, over the 500-LOC `batch-loc-policy` cap (`bin/spine-cli/verify.mjs`, checked by `tests/cli/phase23-exit-verify.test.mjs`). Fixed by compacting comments and removing the no-op relative-path branch in `isHonorableReviewEvent` (relative paths are worker-relative and always accepted per the #328 predicate contract) → 498 lines, behavior unchanged, contract testCommand still 58/58. |
| 10 | `npm run coverage:check` must run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset inside a worker session — otherwise nested `spine batch start` subprocesses in tests hit the SP-482 nested-spawn guard (44 false failures). |

## Blockers

_None._
