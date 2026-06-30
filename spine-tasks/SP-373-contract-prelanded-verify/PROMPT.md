# Task: SP-373 — Contract verify pre-landed scope satisfaction

**Created:** 2026-06-30
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Contract verifier semantics change; affects final review gate.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #56** (partial): extend contract verification so pre-landed `fileScopeMustChange` paths on `main` do not fail final review when delivery artifacts and `testCommand` pass (SP-358/SP-359 pattern).

## Dependencies

None

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-prelanded.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-prelanded.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/contract-prelanded.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #56 and SP-358/SP-359 PROMPT amendments
- [ ] Trace verifyStubFileScopeMustChange and final verify paths

### Step 1: Pre-landed heuristic

- [ ] Implement satisfaction when scope paths unchanged vs merge-base but testCommand/artifacts pass
- [ ] Regression tests for delivery-only STATUS.md tasks

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Note behavior in contract-template skill reference if needed via STATUS

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `skills/create-spine-tasks/references/contract-template.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-373): complete Step N — description`
- `fix(SP-373): description`
- `test(SP-373): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
