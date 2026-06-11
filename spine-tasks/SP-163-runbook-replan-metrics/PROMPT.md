# Task: SP-163 — Runbook replan and metrics

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Operator runbook sections for needs_replan, contract mode, metrics.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-138b

## Mission

Add runbook sections: needs_replan diagnosis, Contract mode config, spine metrics show usage.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-157
- **Task:** SP-169

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

- [ ] Read handoff §11.1 entry for SP-163
- [ ] Dependencies satisfied (SP-157, SP-169)

### Step 1: needs_replan: edit PROMPT, retry flow

- [ ] needs_replan: edit PROMPT, retry flow

### Step 2: Contract mode and legacy TP-* guidance

- [ ] Contract mode and legacy TP-* guidance; spine metrics show usage

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-163

## Git Commit Convention

- `feat(SP-163): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
