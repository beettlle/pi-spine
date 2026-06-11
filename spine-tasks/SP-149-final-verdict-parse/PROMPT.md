# Task: SP-149 — Final verdict parsing

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** parseReviewVerdict extension for PASS/REVISE/REPLAN.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-129a

## Mission

Extend parseReviewVerdict to accept PASS, REVISE, REPLAN when reviewType is final. Step enums unchanged.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-142

## Context to Read First

**Tier 3:**
- `src/batch/review.mjs`
- `tests/batch/review.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `tests/batch/review.test.mjs`

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

- [ ] Read handoff §11.1 entry for SP-149
- [ ] Dependencies satisfied (SP-142)

### Step 1: parseReviewVerdict(content, { reviewType: 'final' }) ac


> **Plan-review checkpoint**
- [ ] parseReviewVerdict(content, { reviewType: 'final' }) accepts PASS/REVISE/REPLAN

### Step 2: Regression: step APPROVE/REVISE tests unchanged


> **Code review checkpoint**
- [ ] Regression: step APPROVE/REVISE tests unchanged

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Review docs per Documentation Requirements
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-149

## Git Commit Convention

- `feat(SP-149): complete Step N — description`

## Do NOT

- Break step APPROVE/REVISE (M-UXB-07)

---

## Amendments (Added During Execution)
