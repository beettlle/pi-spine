# SP-834: Engine reviewer spawns use the effective reviewer profile — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `runNonMatrixTaskOnLane`, `runPlanReviewPhase`, `runCodeReviewPhase`, `runFinalReviewPhase`, `runStepReview` — record callers in Discoveries
- [ ] Find where the lane's parsed PROMPT is available (queue packet vs re-parse) and record it

### Step 1: Task agent context helpers
**Status:** ⬜ Not Started

- [ ] `resolveTaskWorkerProfile` and `buildTaskReviewConfig` (pure)

### Step 2: Engine + resume wiring and runtime guard
**Status:** ⬜ Not Started

- [ ] Review phases receive the per-task review config (fresh run and resume)
- [ ] `review.blocked` fails the task before spawning; `review.reviewer_resolved` journaled
- [ ] `review.started` carries `reviewerModel` / `reviewerThinking`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Helpers: PROMPT reviewer profile wins; worker profile `reviewerProfile` used when PROMPT absent; `agents.reviewerProfile` default; per-type plan/code/final pins differ correctly
- [ ] Quota fallback hop to a Gemini worker switches the reviewer to the fallback profile's `reviewerProfile` (cross-family)
- [ ] Same-family with no alternative → `review.blocked`, no reviewer spawn (stub engine run)
- [ ] `review.started` payload includes reviewer model/thinking

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook "Reviewer profiles" section and prompt-template fields
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-834-engine-reviewer-profile-wiring/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
