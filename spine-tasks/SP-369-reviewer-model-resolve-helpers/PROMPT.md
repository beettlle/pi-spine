# Task: SP-369 — Reviewer per-type model resolution helpers

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Pure config resolution helpers; no spawn behavior yet.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add **GitHub issue #53** (partial): pure helpers `resolveReviewerModelPin(config, reviewType)` and `resolveReviewerThinkingPin(config, reviewType)` with cascade `agents.reviewer.<type>.*` → top-level → omit/`inherit`.

## Dependencies

None

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-spawn.mjs`
- `src/config/agent-model-resolve.mjs`
- `tests/batch/reviewer-model-resolve.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/reviewer-model-resolve.test.mjs` |
| fileScopeMustChange | `src/config/agent-model-resolve.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/reviewer-model-resolve.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #53 resolution rules
- [ ] Read `buildReviewerPiArgs` and SP-232 worker pin pattern

### Step 1: Implement resolution helpers

- [ ] Add `src/config/agent-model-resolve.mjs` with model/thinking cascade for plan|code|final
- [ ] Export helpers; unit-test cascade, inherit, and missing per-type blocks

### Step 2: Testing & Verification

- [ ] Run targeted tests
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Update STATUS.md discoveries if any
- [ ] Do not close #53 (delivery in SP-372)

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-369): complete Step N — description`
- `fix(SP-369): description`
- `test(SP-369): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
