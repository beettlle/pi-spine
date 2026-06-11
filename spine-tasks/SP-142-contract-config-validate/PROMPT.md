# Task: SP-142 — Contract config validation

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** contract.mode enum validation and legacyTaskIdPrefixes defaults.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

**Replaces:** SP-123b

## Mission

Add contract section to config schema: mode enum (required|optional|legacy) and legacyTaskIdPrefixes default [TP-].

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-141

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §3`
- `src/config/*.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/*.mjs`
- `tests/config/contract-mode.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-142
- [ ] Dependencies satisfied (SP-141)

### Step 1: Add contract block to template and config validation

- [ ] Add contract block to template and config validation

### Step 2: Unit tests: defaults, invalid mode rejected, legacy pre

- [ ] Unit tests: defaults, invalid mode rejected, legacy prefix array

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update: docs/adoption/operator-runbook.md — contract config table
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md — contract config table`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-142

## Git Commit Convention

- `feat(SP-142): complete Step N — description`

## Do NOT

- Implement parseContract (SP-143)

---

## Amendments (Added During Execution)
