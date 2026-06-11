# Task: SP-194 — Block nested pi reviewer from worker session

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Prevent trigger — `spawnReviewerPi()` must not spawn pi-from-pi inside an active worker session.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When `spine_review_step` / `runStepReview` is invoked from inside a live pi worker (`SPINE_WORKER_RUNNER=1` or equivalent), **fail fast** with `spawnFailed: true` and a clear error instead of `spawnSync("pi", …)` nested reviewer.

**Incident:** SP-190 worker log: "`spine review step` hung on spawn" — nested reviewer pi (PID 38603) blocked outer worker after work completed.

**Deliverables:**
1. Guard in `src/batch/review.mjs` `spawnReviewerPi()` (or `runStepReview` preflight).
2. `spine_review_step` tool returns structured `spawnFailed` + message directing worker to skip in-worker code review (engine will run — SP-195).
3. Unit tests for guard on/off.

## Dependencies

- **Task:** SP-193

## Context to Read First

**Tier 3:**
- `src/batch/review.mjs` — `spawnReviewerPi`, `runStepReview`
- `extensions/spine/worker-tools.ts` — `executeSpineReviewStep`
- `bin/spine-worker-runner.mjs` — env vars set for worker child

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `extensions/spine/worker-tools.ts`
- `tests/worker-tools/review-step-tool.test.mjs`
- `tests/batch/nested-reviewer-guard.test.mjs` (new)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | see File Scope |
| fileScopeMustNotChange | — |
| minLineCoverage | 77 |
| artifactsMustExist | — |

## Steps

### Step 0: Preflight

- [ ] Identify reliable env marker for "inside worker" (`SPINE_WORKER_RUNNER`, `SPINE_JOURNAL_ATTACH`, etc.)
- [ ] Confirm plan review at step 0 still works via engine or stub paths

### Step 1: Implement guard

- [ ] Fail closed on nested spawn; journal `review.failed` with `nested_spawn_blocked`
- [ ] Tool error text explains engine-owned review (SP-195)

### Step 2: Testing & Verification

- [ ] Test: guard blocks spawn when worker env set
- [ ] Test: engine/direct CLI review spawn still allowed when worker env absent
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Update findings.md
- [ ] Create `.DONE`

## Completion Criteria

- [ ] No `spawnSync("pi")` reviewer launch from active worker context
- [ ] Clear operator-facing error in tool output

## Git Commit Convention

- `feat(SP-194): complete Step N — description`

## Do NOT

- Disable worker plan review stubs in CI
- Remove `spine_review_step` tool entirely
