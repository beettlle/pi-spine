# Task: SP-873 — Post-hoc Step 0 plan review: do not reject finished work as premature

**Created:** 2026-11-19
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** Strict plan reviewers REVISE finished lanes as "premature completion"; retry re-enters the same review and ends review_exhausted.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** Engine runs Step 0 plan review after the worker finishes (in-worker plan reviews are nested_spawn_blocked). The plan prompt in review-step.mjs does not say the review is post-hoc, so reviewers treat checked steps + .DONE as premature completion.

## Mission

Closes #331 — Post-hoc Step 0 plan review must not reject already-finished work as premature completion.

1. **Prompt** — In the plan-review prompt builder (`src/batch/review-step.mjs`), state clearly that this review runs **after** the worker finished (post-hoc / engine-owned), so completed STATUS checkboxes and `.DONE` are expected — not evidence of premature completion.
2. **Guidance** — Reviewers should judge plan quality / fit to the PROMPT, not whether implementation already happened.
3. **Tests** — Assert the plan prompt (or fixture) contains post-hoc wording; keep APPROVE/REVISE contract unchanged.
4. **Do not** change verdict parsing or auto-APPROVE finished lanes.

## Dependencies

- **None**

## Context to Read First

- GitHub #331
- `src/batch/review-step.mjs` (plan branch of prompt builder)
- `src/batch/engine-lanes/review-plan.mjs` (engine-owned plan phase)
- Related: SP-814 Partial #294 item 3 (auto-retry); this task is prompt semantics only

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/review-step.mjs`
- `tests/batch/review-step.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/review-step.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-873` |
| fileScopeMustChange | `src/batch/review-step.mjs`, `tests/batch/review-step.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on plan prompt builder
- [ ] Confirm call sites for plan reviewType

### Step 1: Post-hoc plan prompt

- [ ] Add post-hoc wording to plan review prompt
- [ ] Keep APPROVE/REVISE output contract

### Step 2: Tests

- [ ] Assert plan prompt includes post-hoc / after-worker guidance

### Step 3: Testing & Verification

- [ ] Run Contract testCommand
- [ ] Fix failures

### Step 4: Documentation & Delivery

- [ ] Discoveries in STATUS
- [ ] Create .DONE

- [ ] Create `spine-tasks/SP-873-posthoc-plan-review-prompt/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (metrics / plan-review sections when relevant)

## Completion Criteria

- [ ] GitNexus impact on plan prompt builder
- [ ] Confirm call sites for plan reviewType
- [ ] Add post-hoc wording to plan review prompt
- [ ] Keep APPROVE/REVISE output contract
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-873): post-hoc plan review prompt (#331)`

## Do NOT

- Auto-APPROVE plan reviews when .DONE exists
- Change code/final review prompts except shared helpers if required
- Reorder plan-review spawn (#294 — SP-874)
- Edit `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
