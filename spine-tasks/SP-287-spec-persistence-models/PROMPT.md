# Task: SP-287 — Spec persistence models doc

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only; names explicit persistence strategies for spine operators.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Create `docs/adoption/spec-persistence.md` documenting how pi-spine teams maintain specs and task packets when requirements change — adapted from [spec-kit spec persistence models](https://github.com/github/spec-kit/blob/main/docs/concepts/spec-persistence.md).

**Content:**
1. **Flow-forward** — new task folder per change; historical audit trail (default pi-spine model).
2. **Living spec** — edit upstream PRD/spec and regenerate packets via `create-spine-tasks`.
3. **Flow-back** — any artifact can lead; reconcile manually via PROMPT amendments, `needs_replan`, `spine batch retry`.

Map each model to pi-spine mechanics: task folders, `PROMPT.md` amendments below `---`, `.SUPERSEDED` markers, `needs_replan` verdict, `spine batch retry`.

Link from `docs/adoption/upstream-execution-workflow.md` and `skills/create-spine-tasks/SKILL.md`.

## Dependencies

- **None**

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `docs/adoption/upstream-execution-workflow.md` — Final verdict and replan section
- `spine-tasks/CONTEXT.md` — `.SUPERSEDED` example (SP-257→263)
- `skills/create-spine-tasks/SKILL.md` — Amendments section in prompt template

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/spec-persistence.md`
- `docs/adoption/upstream-execution-workflow.md`
- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | docs/adoption/spec-persistence.md |
| artifactsMustExist | docs/adoption/spec-persistence.md |

## Steps

### Step 0: Preflight

- [ ] Read spec-kit spec-persistence.md for terminology alignment
- [ ] Identify pi-spine examples (SP-257 superseded, PROMPT amendments)

### Step 1: Write spec-persistence.md

- [ ] Define three models with when-to-use guidance
- [ ] Map to spine task folders, STATUS.md, replan flow
- [ ] Include operator decision table (requirement changed → which model)

### Step 2: Cross-links

- [ ] Link from upstream-execution-workflow.md (new subsection or Further reading)
- [ ] One paragraph in create-spine-tasks SKILL under PRD decomposition

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Verify links resolve
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/spec-persistence.md` (new)
- `docs/adoption/upstream-execution-workflow.md`
- `skills/create-spine-tasks/SKILL.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-287): complete Step N — description`
- `docs(SP-287): description`

## Do NOT

- Change batch engine replan behavior
- Add runtime spec persistence logic

---

## Amendments (Added During Execution)
