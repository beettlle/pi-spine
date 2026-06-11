# Task: SP-168 — Agent templates final verdict

**Created:** 2026-06-11
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Worker and reviewer template updates for final + contract.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-133

## Mission

Update templates/agents/worker.md and reviewer.md for final verdict and contract verification per §8.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-150
- **Task:** SP-155

## Context to Read First

**Tier 3:**
- `templates/agents/worker.md`
- `templates/agents/reviewer.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/agents/worker.md`
- `templates/agents/reviewer.md`
- `tests/agent-template-drift.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-168
- [ ] Dependencies satisfied (SP-150, SP-155)

### Step 1: Worker: final review sequence before .DONE

- [ ] Worker: final review sequence before .DONE

### Step 2: Reviewer: PASS/REVISE/REPLAN section

- [ ] Reviewer: PASS/REVISE/REPLAN section; extend drift test

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
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-168

## Git Commit Convention

- `feat(SP-168): complete Step N — description`

## Do NOT

- Change step review enums

---

## Amendments (Added During Execution)
