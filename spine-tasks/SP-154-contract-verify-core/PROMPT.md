# Task: SP-154 — Contract verify core

**Created:** 2026-06-11
**Size:** S

## Review Level: 3 (Full)

**Assessment:** testCommand and artifactsMustExist machine checks.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-131a

## Mission

Create src/batch/contract-verify.mjs with testCommand (exit 0) and artifactsMustExist checks.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-144
- **Task:** SP-150

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §4.5`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `tests/batch/contract-verify.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-154
- [ ] Dependencies satisfied (SP-144, SP-150)

### Step 1: verifyContract runs testCommand in worktree


> **Plan-review checkpoint**
- [ ] verifyContract runs testCommand in worktree; checks artifactsMustExist

### Step 2: Return ContractVerifyResult with per-check ok/message


> **Code review checkpoint**
- [ ] Return ContractVerifyResult with per-check ok/message

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-154

## Git Commit Convention

- `feat(SP-154): complete Step N — description`

## Do NOT

- Hook into engine yet (SP-155)

---

## Amendments (Added During Execution)
