# Task: SP-291 — Skill lean full modes

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Skill documentation consolidation; no code changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Document **lean vs full** authoring modes in `create-spine-tasks` and bump skill version to **1.1.0**.

| Mode | Pipeline |
|------|----------|
| **Lean** | Optional Step 0 explore → Step A read → Step B slice → Step C track |
| **Full** | Step 0 (if brownfield) → clarify → checklist → optional LLM analyze report (`_authoring/{slug}/analyze.md`) → slice → track |

Update architecture diagram, mode selection table (when to use full), Definition of Ready checklist, and reference `spine tasks analyze pending` (SP-292) as post-decomposition structural check.

## Dependencies

- **Task:** SP-289 (clarify step)
- **Task:** SP-290 (checklist step)

## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | `cursor/auto` |
| Reviewer | `google/gemini-3.1-pro-preview` |

## Context to Read First

- `skills/create-spine-tasks/SKILL.md` — after SP-289/290
- `docs/adoption/upstream-execution-workflow.md` — Path 4 full pipeline

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | skills/create-spine-tasks/SKILL.md |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-289 and SP-290 merged
- [ ] Read spec-kit lean preset README for terminology alignment

### Step 1: Lean/full modes section

- [ ] Add "Authoring modes" section near PRD decomposition workflow
- [ ] Update architecture ASCII diagram
- [ ] Bump frontmatter version to 1.1.0
- [ ] Add optional Step C.5 analyze.md guidance (LLM-authored, read-only)
- [ ] Reference `spine tasks analyze` for structural checks after decomposition

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Skill version 1.1.0 in frontmatter
- [ ] `.DONE` created

## Git Commit Convention

- `feat(SP-291): complete Step N — description`

## Do NOT

- Implement analyze CLI (SP-292 scope)
- Change batch engine behavior

---

## Amendments (Added During Execution)
