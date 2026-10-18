# SP-834: Engine reviewer spawns use the effective reviewer profile — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `runNonMatrixTaskOnLane`, `runPlanReviewPhase`, `runCodeReviewPhase`, `runFinalReviewPhase`, `runStepReview` — record callers in Discoveries
- [x] Find where the lane's parsed PROMPT is available (queue packet vs re-parse) and record it

### Step 1: Task agent context helpers
**Status:** ✅ Complete

- [x] `resolveTaskWorkerProfile` and `buildTaskReviewConfig` (pure)

### Step 2: Engine + resume wiring and runtime guard
**Status:** ✅ Complete

- [x] Review phases receive the per-task review config (fresh run and resume)
- [x] `review.blocked` fails the task before spawning; `review.reviewer_resolved` journaled
- [x] `review.started` carries `reviewerModel` / `reviewerThinking`

### Step 3: Tests
**Status:** ✅ Complete

- [x] Helpers: PROMPT reviewer profile wins; worker profile `reviewerProfile` used when PROMPT absent; `agents.reviewerProfile` default; per-type plan/code/final pins differ correctly
- [x] Quota fallback hop to a Gemini worker switches the reviewer to the fallback profile's `reviewerProfile` (cross-family)
- [x] Same-family with no alternative → `review.blocked`, no reviewer spawn (stub engine run)
- [x] `review.started` payload includes reviewer model/thinking

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook "Reviewer profiles" section and prompt-template fields
- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-834-engine-reviewer-profile-wiring/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| GitNexus impact: `runNonMatrixTaskOnLane` — LOW, 1 caller (`runTaskOnLane`, via `runWithQuotaFallback`). `runPlanReviewPhase` — HIGH, callers `runNonMatrixTaskOnLane` and `runLaneReviewPhasesBeforeCommit` (→ `resume.mjs`, `resume-multi-lanes.mjs` ×2). `runStepReview` — HIGH, callers `runEnginePlanReview` / `runEngineCodeReview` / `runEngineFinalReview`. Code/final phases share the plan phase's callers. | Recorded | Step 0 |
| Parsed PROMPT is not retained on the lane/queue packet (`loadTaskFileScopePaths` returns only `fileScopePaths`), so the review config re-parses `PROMPT.md` in the worktree via `loadTaskPacket`. | Implemented (`applyTaskReviewProfile`) | `src/batch/engine-lanes/task-agent-profile.mjs` |
| `src/batch/engine-lanes.mjs` sits at the 500-LOC batch module cap; all orchestration (journal, guard, task failure) lives in `task-agent-profile.mjs` and two re-exports were collapsed to one line each. | Resolved | `src/batch/engine-lanes.mjs` |
| Review Level 1 runs plan + final reviews, so a blocked pairing journals two `review.blocked` events (plan, final); the task fails with the first (`plan_review_blocked`). | By design | `tests/batch/engine-reviewer-profile.test.mjs` |
| Stub-mode engine plan review (`runEnginePlanReview` stub branch, `review-plan.mjs`) journals `review.started` without `reviewerModel` / `reviewerThinking`; only `runStepReview` (real spawn path and `stub:true` direct calls) carries them. `review-plan.mjs` is outside this task's File Scope. | Not changed — follow-up if stub parity is wanted | `src/batch/engine-lanes/review-plan.mjs` |
| The worker spawn does not yet read PROMPT `**Profile:**` / `**Thinking:**` (SP-835); the prompt template says so. | Documented | `skills/create-spine-tasks/references/prompt-template.md` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-18 | Steps 0–3 and 5 (docs) implemented | lint, typecheck and Contract unit tests pass |
| 2026-10-18 | Stet review (lenient) | 3 findings dismissed with evidence (LOC-cap reformat, config early-return, stub env); rerun reports 0 findings |
| 2026-10-18 | Contract `testCommand` | Exit 0 |
| stet contract findings dismissed (reviewer bugs): (a) `engine-lanes.mjs` "wrong import path" — `./engine-lanes/task-agent-profile.mjs` resolves correctly from `src/batch/` (lint, typecheck, tests pass); (b) "task left running when profile blocked" — `applyTaskReviewProfile` sets `failed`/`endedAt`/`exitReason`, recomputes counters and saves state itself; (c) "plan/final use base config" — all three phases receive `reviewConfig`; (d) "`warnings` never populated" — `buildTaskReviewConfig` returns `reviewer.warnings` and the test passes; (e) "export reformat noise" — the single-line re-exports are required to keep `engine-lanes.mjs` ≤500 LOC (FR-SHIP-02). | Dismissed (false_positive / already_correct / wrong_suggestion) | `src/batch/engine-lanes.mjs` |
| The contract `testCommand` must run with `SPINE_IS_WORKER` unset: `quota-fallback-integration.test.mjs` starts nested batches and fails with `Nested batch start blocked` inside a worker shell. | Environment note | `tests/batch/quota-fallback-integration.test.mjs` |
