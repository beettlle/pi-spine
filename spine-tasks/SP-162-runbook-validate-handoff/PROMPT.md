# Task: SP-162 — Runbook validate and handoff

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Operator runbook sections for validate and handoff.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-138a

## Mission

Add operator runbook sections: spine tasks validate and spine handoff workflow.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-146
- **Task:** SP-148

## Context to Read First

**Tier 3:**
- `docs/adoption/operator-runbook.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-162
- [ ] Dependencies satisfied (SP-146, SP-148)

### Step 1: spine tasks validate section: when, scope, fixing error

- [ ] spine tasks validate section: when, scope, fixing errors

### Step 2: spine handoff section: session continuity workflow

- [ ] spine handoff section: session continuity workflow

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update: docs/adoption/operator-runbook.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-162

## Git Commit Convention

- `feat(SP-162): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
