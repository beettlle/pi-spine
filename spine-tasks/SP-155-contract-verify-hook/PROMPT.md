# Task: SP-155 — Contract verify engine hook

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** file scope, coverage checks, engine-lanes integration.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-131b

## Mission

Add fileScopeMustChange/NotChange and minLineCoverage checks; hook verifier into final review path in engine-lanes.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-154
- **Task:** SP-151

## Context to Read First

**Tier 3:**
- `src/batch/engine-lanes.mjs`
- `src/batch/review.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/review.mjs`
- `tests/batch/contract-verify.test.mjs`

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

- [ ] Read handoff §11.1 entry for SP-155
- [ ] Dependencies satisfied (SP-154, SP-151)

### Step 1: fileScope and minLineCoverage checks


> **Plan-review checkpoint**
- [ ] fileScope and minLineCoverage checks; reuse coverage parser

### Step 2: Hook into final review before reviewer spawn


> **Code review checkpoint**
- [ ] Hook into final review before reviewer spawn; skip for legacy TP-*

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-155

## Git Commit Convention

- `feat(SP-155): complete Step N — description`

## Do NOT

- Run verifier on step reviews

---

## Amendments (Added During Execution)
