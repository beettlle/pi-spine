# Task: SP-282 — Reviewer early artifact honor (hung pi follow-up)

**Created:** 2026-06-18
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Review reliability — reviewer `pi` wrote APPROVE artifact in ~3 minutes but subprocess hung ~90 minutes; SP-279 async timeout recovered only at full stall budget.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #5**: during batch `20260618T000943`, SP-279 **code review** produced artifact `2-20260618T004017.md` with APPROVE but the reviewer `pi` child did not exit. The engine waited the full review spawn timeout (~90 minutes) before `honorReviewSpawnFailureWhenEligible` stubbed completion.

**Required behavior:**
1. While awaiting reviewer `pi` exit, **poll for a terminal on-disk review artifact** (APPROVE/PASS/REVISE/REPLAN per review type) and complete the review without waiting for the full stall-budget timeout when artifact is valid.
2. After honoring an on-disk artifact, **terminate** the hung reviewer child (fail-closed; journal `review.completed` with `honorReason: artifact_ready`).
3. Keep SP-279 async spawn + timeout as backstop — early honor must not skip contract verification on final reviews.
4. Add fixture test from batch `20260618T000943` journal (code review stall pattern).

**Closes:** [#5](https://github.com/beettlle/pi-spine/issues/5)

## Dependencies

- **Task:** SP-285 (engine reviewer spawn env stable before early-artifact honor)

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `spine-tasks/SP-279-engine-final-review-stall-recovery/PROMPT.md`
- `src/batch/review.mjs` — `runStepReview`, `honorReviewSpawnFailureWhenEligible`
- `src/batch/review-spawn.mjs` (after SP-267/268)
- `src/batch/task-stall-budget.mjs` — `resolveReviewSpawnTimeoutMs`
- `tests/batch/review-spawn-timeout-recovery.test.mjs`
- `tests/batch/engine-final-review-timeout.test.mjs`
- GitHub issue #5 body; archived journal `.spine/runtime/20260618T000943/archive/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (stub / fixture tests)

## File Scope

- `src/batch/review.mjs`
- `src/batch/review-spawn.mjs`
- `src/batch/task-stall-budget.mjs`
- `tests/batch/reviewer-artifact-early-honor.test.mjs` (new)
- `tests/batch/review-spawn-timeout-recovery.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | src/batch/review.mjs, tests/batch/reviewer-artifact-early-honor.test.mjs |
| minLineCoverage | 77 |
| artifactsMustExist | tests/batch/reviewer-artifact-early-honor.test.mjs |

## Steps

### Step 0: Preflight

- [ ] Reconstruct SP-279 code-review stall from issue #5 (`review.started` 00:40:17, artifact ~00:43, `review.completed` 02:10:17 with `spawn_timeout_with_done`)
- [ ] Identify artifact parse path (verdict extraction) reusable for early honor
- [ ] Confirm SP-279 async spawn entry points after SP-268 extraction

### Step 1: Early artifact honor loop

> **Plan-review checkpoint**

- [ ] During reviewer wait, poll for expected artifact path on an interval (bounded, configurable; default ≤30s) once file is stable (mtime quiescence)
- [ ] When artifact contains terminal verdict, journal `review.completed`, kill hung `pi` child, return success — do not wait for full `resolveReviewSpawnTimeoutMs`
- [ ] Final review: only honor early when contract verification already passed (same guard as `honorReviewSpawnFailureWhenEligible`)
- [ ] Preserve existing timeout honor path when no artifact appears

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] `reviewer-artifact-early-honor.test.mjs`: simulated hung spawn + on-disk APPROVE → completes in seconds, child killed
- [ ] Regression: `review-spawn-timeout-recovery.test.mjs`, `engine-final-review-timeout.test.mjs`
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Operator-runbook entry: hung reviewer with artifact on disk (symptoms + expected recovery time)
- [ ] Close GitHub issue #5: `gh issue close 5 --comment "Fixed in SP-282: engine honors on-disk reviewer artifact and kills hung pi without waiting full stall timeout."`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — reviewer artifact early honor

**Check If Affected:**
- `src/batch/task-stall-budget.mjs` — poll interval env override if added

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] Issue #5 closed with comment referencing SP-282
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-282): complete Step N — description`
- `fix(SP-282): description`
- `test(SP-282): description`

## Do NOT

- Honor partial/invalid artifacts (must parse terminal verdict)
- Skip contract verification on final reviews
- Remove SP-279 timeout backstop entirely

## Amendments (Added During Execution)

### Amendment 1 — 2026-06-18
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to SP-294, SP-295.

