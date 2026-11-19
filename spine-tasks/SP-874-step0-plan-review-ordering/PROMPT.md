# Task: SP-874 — Step-0 plan review spawn ordering before later-step plan reviews

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Step-0 plan review spawns after later-step plan reviews; no-artifact spawn failures fail the batch even when the lane has .DONE.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 2, Security: 0, Reversibility: 0
**Problem theory:** Engine-owned step-0 plan review is scheduled after the worker already requested plan reviews for later steps. The late step-0 reviewer often exits with no artifact (plan_review_spawn_failed). SP-814 covered bounded auto-retry (Partial item 3); items 1–2 (ordering) remain.

## Mission

Closes #294 — Remaining items: step-0 plan review must be ordered before later-step plan reviews for the same lane.

1. **Ordering** — Ensure engine-owned Step 0 plan review runs (or is queued) **before** later-step plan reviews for that task/lane.
2. **No silent skip** — Do not drop required step-0 plan review; preserve fail-closed behavior with clearer ordering.
3. **Tests** — Unit/integration coverage that step 0 is scheduled first when multiple plan reviews exist.
4. **Out of scope** — Prompt premature-completion wording (SP-873); bounded auto-retry already shipped (SP-814).

## Dependencies

- **None** (disjoint from SP-873 prompt text; serialize in batch if analyze shows shared hot files)

## Context to Read First

- GitHub #294 (Expected items 1–2)
- `src/batch/engine-lanes/review-plan.mjs`
- `src/batch/engine-lanes.mjs` / resume-lane-reviews paths that schedule plan reviews
- Parent split note: SP-814 Partial #294 item 3 already done

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/review-plan.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/review-plan-phase.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-plan-phase.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-874` |
| fileScopeMustChange | `src/batch/engine-lanes/review-plan.mjs`, `tests/batch/review-plan-phase.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Map where step-0 vs later plan reviews are spawned
- [ ] GitNexus impact on runPlanReviewPhase

### Step 1: Ordering fix

- [ ] Schedule step-0 plan review before later-step plan reviews
- [ ] Preserve fail-closed spawn failure paths

### Step 2: Tests

- [ ] Assert step 0 is first when multiple plan reviews are queued

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-874-step0-plan-review-ordering/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] Map where step-0 vs later plan reviews are spawned
- [ ] GitNexus impact on runPlanReviewPhase
- [ ] Schedule step-0 plan review before later-step plan reviews
- [ ] Preserve fail-closed spawn failure paths
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-874): step-0 plan review ordering (#294)`

## Do NOT

- Change post-hoc prompt text (SP-873)
- Weaken plan review requirements for RL≥1
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
