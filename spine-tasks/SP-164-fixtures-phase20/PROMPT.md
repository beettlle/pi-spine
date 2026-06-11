# Task: SP-164 — Phase 20 fixtures

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** FX fixtures for validate, contract, and REPLAN paths.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-139a

## Mission

Create test fixtures: FX-invalid-no-testing, FX-missing-contract, FX-valid-contract, FX-final-replan.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-146
- **Task:** SP-153

## Context to Read First

**Tier 3:**
- `test/fixtures/taskplane/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `test/fixtures/taskplane/FX-*`

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

- [ ] Read handoff §11.1 entry for SP-164
- [ ] Dependencies satisfied (SP-146, SP-153)

### Step 1: Create or consolidate FX fixtures for validate and cont


> **Plan-review checkpoint**
- [ ] Create or consolidate FX fixtures for validate and contract paths

### Step 2: FX-final-replan fixture for REPLAN integration path


> **Code review checkpoint**
- [ ] FX-final-replan fixture for REPLAN integration path

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-164

## Git Commit Convention

- `feat(SP-164): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
