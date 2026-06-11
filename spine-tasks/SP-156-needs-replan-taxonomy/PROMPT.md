# Task: SP-156 — needs_replan taxonomy

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Add needs_replan to diagnosis taxonomy.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-132a

## Mission

Add needs_replan to DIAGNOSIS_TAXONOMY in diagnosis.mjs with headline and suggestedCommand.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-153

## Context to Read First

**Tier 3:**
- `src/batch/diagnosis.mjs`
- `docs/PRD-v2.0-implementation-handoff.md §9`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `tests/compat/final-verdict-reconcile.test.mjs`

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

- [ ] Read handoff §11.1 entry for SP-156
- [ ] Dependencies satisfied (SP-153)

### Step 1: Add needs_replan entry with headline and suggestedComma


> **Plan-review checkpoint**
- [ ] Add needs_replan entry with headline and suggestedCommand per §9.1

### Step 2: Unit test for diagnosis messaging shape


> **Code review checkpoint**
- [ ] Unit test for diagnosis messaging shape

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-156

## Git Commit Convention

- `feat(SP-156): complete Step N — description`

## Do NOT

- Change reconcile precedence yet (SP-157)

---

## Amendments (Added During Execution)
