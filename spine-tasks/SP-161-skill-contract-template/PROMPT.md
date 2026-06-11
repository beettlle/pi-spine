# Task: SP-161 — Skill Contract template

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** Contract authoring in prompt-template and new contract-template.md.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-137b

## Mission

Add ## Contract section to prompt-template.md; create contract-template.md; update launch sequence with spine tasks validate.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-144

## Context to Read First

**Tier 3:**
- `docs/PRD-v2.0-implementation-handoff.md §4`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/prompt-template.md`
- `skills/create-spine-tasks/references/contract-template.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-161
- [ ] Dependencies satisfied (SP-144)

### Step 1: Add Contract section to prompt-template with field guid

- [ ] Add Contract section to prompt-template with field guidance

### Step 2: Create contract-template.md with examples

- [ ] Create contract-template.md with examples; update skill launch commands

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update: skills/create-spine-tasks/references/contract-template.md
- [ ] Update: skills/create-spine-tasks/references/prompt-template.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/references/contract-template.md`
- `skills/create-spine-tasks/references/prompt-template.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-161

## Git Commit Convention

- `feat(SP-161): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
