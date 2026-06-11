# Task: SP-160 — Skill explore Step 0

**Created:** 2026-06-11
**Size:** S

## Review Level: 0 (None)

**Assessment:** create-spine-tasks Step 0 explore guidance.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

**Replaces:** SP-137a

## Mission

Update create-spine-tasks SKILL.md with Step 0 Explore when-to-skip guidance; verify explore-template.md.

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

- **Task:** SP-144

## Context to Read First

**Tier 3:**
- `skills/create-spine-tasks/SKILL.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/explore-template.md`

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for SP-160
- [ ] Dependencies satisfied (SP-144)

### Step 1: Document Step 0 Explore with when-to-skip and findings.

- [ ] Document Step 0 Explore with when-to-skip and findings.md path

### Step 2: Verify explore-template.md matches v1.3 §6.3 schema

- [ ] Verify explore-template.md matches v1.3 §6.3 schema

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update: skills/create-spine-tasks/SKILL.md
- [ ] Create `.DONE` when complete

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for SP-160

## Git Commit Convention

- `feat(SP-160): complete Step N — description`

## Do NOT

- Expand scope beyond handoff §11.1

---

## Amendments (Added During Execution)
