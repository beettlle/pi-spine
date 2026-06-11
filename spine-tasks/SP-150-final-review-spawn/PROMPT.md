# Task: SP-150 — Final review spawn path

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** --type final CLI and artifact paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-129b

## Mission

Add spine review step --type final spawn path and .reviews/final-{timestamp}.md artifact naming.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-149

## Context to Read First

**Tier 3:**
- `bin/spine-review-step.mjs`
- `src/batch/review.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review.mjs`
- `bin/spine-review-step.mjs`
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

- [ ] Read handoff §11.1 entry for SP-150
- [ ] Dependencies satisfied (SP-149)

### Step 1: buildFinalReviewArtifactPath helper


> **Plan-review checkpoint**
- [ ] buildFinalReviewArtifactPath helper

### Step 2: CLI --type final documented and tested


> **Code review checkpoint**
- [ ] CLI --type final documented and tested; spawn failure exits non-zero at level ≥1

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-150

## Git Commit Convention

- `feat(SP-150): complete Step N — description`

## Do NOT

- Integrate engine loop yet (SP-151)

---

## Amendments (Added During Execution)
