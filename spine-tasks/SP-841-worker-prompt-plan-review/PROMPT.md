# Task: SP-841 — Stop telling workers to run per-step plan review

**Created:** 2026-10-17
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Worker prompt text shapes every worker run; removing the tool mention entirely would break template drift tests and confuse stub runs.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** `buildReviewLevelHint` (`src/batch/worker-prompt.mjs:16`) says "When Review Level ≥ 1, run plan review only at step checkpoints: spine review step --step N --type plan (or spine_review_step with type=plan)." On real-pi subprocess batches every in-worker call is skipped (`shouldBlockNestedReviewerSpawn`, `review-step-run.mjs:224` → `completeNestedReviewSpawnSkipped`, `review-step.mjs` 252-278, journal `review.skipped` / `nested_spawn_blocked`). The engine already runs plan/code/final reviews after `.DONE` (#250 / SP-695). The shipped template `templates/agents/worker.md` (lines ~56, 69, 73, 84) still tells workers to call `spine_review_step type=plan` at checkpoints; this repo's installed `.spine/agents/worker.md` already says to skip in-worker review (do not edit it).

## Mission

Closes #354 — Workers are told the engine runs reviews after `.DONE`, and no longer spend turns on in-worker plan review calls that are always skipped.

1. `buildReviewLevelHint`: replace the per-step plan review sentence with: reviews (plan, plus code at Level 2, plus final) run in the batch engine after `.DONE`; do not call `spine_review_step` / `spine review step` from the worker. Keep the Level 1 / Level 2 wording for what the engine will review.
2. `templates/agents/worker.md`: same change at each checkpoint instruction. Keep `spine_review_step` listed in the tools table, described as "engine-run in real-pi batches; in-worker calls are skipped".
3. Update tests asserting the old strings: `tests/batch/worker-prompt.test.mjs` 18-19 (`/plan review only/i`, `/type plan/i`) and `tests/agents/template-drift.test.mjs` (~19, ~48, ~79 — keep the tool-name assertion on the template; replace the CLI-mention assertion on the hint with one for the new wording).

## Dependencies

- **None**

## Context to Read First

- GitHub #354
- `src/batch/worker-prompt.mjs` (whole file)
- `templates/agents/worker.md`
- `.spine/agents/worker.md` (read only, for the already-correct wording)
- `tests/batch/worker-prompt.test.mjs`, `tests/agents/template-drift.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-prompt.mjs`
- `templates/agents/worker.md`
- `tests/batch/worker-prompt.test.mjs`
- `tests/agents/template-drift.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-prompt.test.mjs tests/agents/template-drift.test.mjs tests/agents/worker-runner.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-841` |
| fileScopeMustChange | `src/batch/worker-prompt.mjs`, `templates/agents/worker.md`, `tests/batch/worker-prompt.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] `rg -n 'plan review only|type=plan|--type plan' src templates tests` — record every hit in Discoveries

### Step 1: Prompt + template

- [ ] Hint and template wording updated

**Artifacts:**
- `src/batch/worker-prompt.mjs` (modified)
- `templates/agents/worker.md` (modified)

### Step 2: Tests

- [ ] Old-string assertions replaced with new-wording assertions

**Artifacts:**
- `tests/batch/worker-prompt.test.mjs` (modified)
- `tests/agents/template-drift.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-841-worker-prompt-plan-review/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-841`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- `templates/agents/worker.md`

**Check If Affected:**
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] Worker prompt and template no longer instruct in-worker plan review

## Git Commit Convention

- `fix(SP-841): drop per-step plan review instruction from worker prompt (#354)`

## Do NOT

- Remove the `spine_review_step` tool or change nested-spawn blocking
- Edit `.spine/agents/worker.md` or anything else under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
