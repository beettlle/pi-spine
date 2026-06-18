# Task: SP-290 — Skill checklist step

**Created:** 2026-06-18
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Skill and reference template; follows SP-289 clarify step.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add **Step A.6 — Requirements checklist** to `create-spine-tasks`, inspired by spec-kit `/speckit.checklist`. Runs after clarify, before Step B slice.

**Deliverables:**
1. `skills/create-spine-tasks/references/requirements-checklist-template.md`
2. Update SKILL.md Step A.6 with output `{tasksRoot}/_authoring/{slug}/checklist.md`
3. Checklist covers: acceptance criteria quality, security, edge cases, testability, non-functional requirements
4. When-to-run/skip table; link clarify → checklist → slice ordering

## Dependencies

- **Task:** SP-289 (clarify step establishes `_authoring/` convention)

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `skills/create-spine-tasks/SKILL.md` — SP-289 clarify step (after merge)
- `skills/create-spine-tasks/references/clarify-template.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/requirements-checklist-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | skills/create-spine-tasks/SKILL.md, skills/create-spine-tasks/references/requirements-checklist-template.md |
| artifactsMustExist | skills/create-spine-tasks/references/requirements-checklist-template.md |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-289 clarify step merged (or rebase on main)
- [ ] Read clarify-template for consistent tone

### Step 1: Checklist template and skill step

> **Plan-review checkpoint**

- [ ] Create requirements-checklist-template.md
- [ ] Add Step A.6 to SKILL.md after Step A.5
- [ ] Document ordering: clarify → checklist → slice

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/requirements-checklist-template.md` (new)

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-290): complete Step N — description`

## Do NOT

- Duplicate explore findings content in checklist
- Require checklist artifact for `spine tasks validate`

---

## Amendments (Added During Execution)
