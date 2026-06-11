# Task: SP-144 — Contract validate wire-up

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** validateContract + validatePrompt integration and fixtures.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-124b

## Mission

Implement validateContract with contract.mode and TP-* legacy exemption; integrate into validatePrompt.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-143

## Context to Read First

**Tier 3:**
- `src/tasks/packet/validate-prompt.mjs`
- `src/tasks/packet/index.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/tasks/packet/validate-contract.mjs`
- `src/tasks/packet/validate-prompt.mjs`
- `src/tasks/packet/index.mjs`
- `test/fixtures/taskplane/FX-missing-contract/**`
- `test/fixtures/taskplane/FX-valid-contract/**`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-144
- [ ] Dependencies satisfied (SP-143)

### Step 1: validateContract with mode and legacyTaskIdPrefixes rul


> **Plan-review checkpoint**
- [ ] validateContract with mode and legacyTaskIdPrefixes rules

### Step 2: Extend validatePrompt


> **Code review checkpoint**
- [ ] Extend validatePrompt; add FX-missing-contract and FX-valid-contract fixtures

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-144

## Git Commit Convention

- `feat(SP-144): complete Step N — description`

## Do NOT

- Duplicate validation logic outside validate-contract.mjs

---

## Amendments (Added During Execution)
