# Task: SP-289 — Skill clarify step

**Created:** 2026-06-18
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Skill and reference template additions; no engine changes.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add **Step A.5 — Clarify** to the `create-spine-tasks` skill: a read-only ambiguity pass on PRD/brief before task slicing, inspired by spec-kit `/speckit.clarify`.

**Deliverables:**
1. `skills/create-spine-tasks/references/clarify-template.md` — output schema.
2. Update `skills/create-spine-tasks/SKILL.md` with Step A.5 between Step A (Read sources) and Step B (Slice).
3. Output path: `{tasksRoot}/_authoring/{slug}/clarify.md` (open questions, assumptions, resolved decisions).
4. When-to-run/skip table mirroring Step 0 explore patterns.
5. Reference spec-kit `/speckit.clarify` as external equivalent in Path 4 docs cross-link.

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `skills/create-spine-tasks/SKILL.md` — Step 0 explore pattern
- `skills/create-spine-tasks/references/explore-template.md` — template style
- `docs/adoption/upstream-execution-workflow.md` — Path 4 (if SP-286 done, read; else draft against plan)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/clarify-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | skills/create-spine-tasks/SKILL.md, skills/create-spine-tasks/references/clarify-template.md |
| artifactsMustExist | skills/create-spine-tasks/references/clarify-template.md |

## Steps

### Step 0: Preflight

- [ ] Read Step 0 explore structure for consistency
- [ ] Pick `_authoring/{slug}/` convention (parallel to `_explore/{slug}/`)

### Step 1: Clarify template and skill step

> **Plan-review checkpoint**

- [ ] Create `clarify-template.md` with: Summary, Open questions, Assumptions, Resolved decisions, Blockers for decomposition
- [ ] Add Step A.5 to SKILL.md with when-to-run/skip table
- [ ] Update References section and Definition of Ready checklist

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify relative links in SKILL.md resolve

### Step 3: Documentation & Delivery

- [ ] Bump skill version comment in frontmatter if present (note 1.1.0 pending SP-291)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/clarify-template.md` (new)

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-289): complete Step N — description`
- `docs(SP-289): description`

## Do NOT

- Add clarify as batch engine requirement
- Create runtime validation for clarify artifacts

---

## Amendments (Added During Execution)
