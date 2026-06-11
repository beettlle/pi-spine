# Task: SP-143 — Contract parser

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Pure parseContract module with unit tests.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-124a

## Mission

Implement parseContract(markdown) extracting the ## Contract table per handoff §4.3.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-142

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §4`
- `src/tasks/packet/parse-prompt.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/tasks/packet/validate-contract.mjs`
- `tests/tasks/contract-parse.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-143
- [ ] Dependencies satisfied (SP-142)

### Step 1: Implement parseContract → ParsedContract with all five 


> **Plan-review checkpoint**
- [ ] Implement parseContract → ParsedContract with all five fields

### Step 2: Unit tests for valid table, empty table, unknown fields


> **Code review checkpoint**
- [ ] Unit tests for valid table, empty table, unknown fields as warnings

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-143

## Git Commit Convention

- `feat(SP-143): complete Step N — description`

## Do NOT

- Wire into validatePrompt yet (SP-144)

---

## Amendments (Added During Execution)
