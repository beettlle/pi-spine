# Task: SP-492 — Skill fileScopeMustChange for docs-only tasks

**Created:** 2026-07-04
**Size:** S

## Review Level: 0 (None)

**Assessment:** Skill and template documentation-only changes to prevent `.DONE`-only contract passes on docs tasks. No runtime code changes.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-492-skill-filescope-docs-only/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Two batches were rejected because docs-only tasks with `testCommand: true` and **no `fileScopeMustChange`** passed contract with only a `.DONE` file and zero meaningful changes (SP-214 batch `20260612T204048`, SP-457 batch `20260703T022335`).

Update the create-spine-tasks skill and contract template to require `fileScopeMustChange` on all docs-only tasks (`testCommand: true`), especially when no application code changes.

**Closes:** [#139](https://github.com/beettlle/pi-spine/issues/139)

## Dependencies

- **Task:** SP-494 (stet Option A bootstrap — batch ordering)

## Context to Read First

**Tier 3 (load only if needed):**
- GitHub issue #139
- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/contract-template.md`
- `skills/create-spine-tasks/references/requirements-checklist-template.md`

## Environment

- **Workspace:** `skills/create-spine-tasks/`
- **Services required:** None

## File Scope

- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/contract-template.md`
- `skills/create-spine-tasks/references/requirements-checklist-template.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/create-spine-tasks/SKILL.md`, `skills/create-spine-tasks/references/contract-template.md`, `skills/create-spine-tasks/references/requirements-checklist-template.md` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #139 acceptance criteria
- [ ] Read current docs-only contract example in contract-template.md

### Step 1: Update contract template and skill Contract section

- [ ] Add mandatory guidance: when `testCommand` is `true` (docs-only), **always** include `fileScopeMustChange` listing at least one documentation file the task must modify
- [ ] Update the "Docs-only Review Level 0" example in `contract-template.md` to include `fileScopeMustChange` (e.g. `docs/adoption/operator-runbook.md`)
- [ ] Add equivalent guidance to the Contract section in `SKILL.md`
- [ ] Reference SP-214 and SP-457 incidents as evidence

### Step 2: Update Definition of Ready checklist

- [ ] Add to `requirements-checklist-template.md` and/or SKILL.md Definition of Ready: `If testCommand is true, fileScopeMustChange MUST list at least one deliverable path.`

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures
- [ ] Build passes: `npm run typecheck`

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Close GitHub issue #139: `gh issue close 139 --comment "Skill + contract template updated — SP-492"`

## Documentation Requirements

**Must Update:**
- `skills/create-spine-tasks/SKILL.md`
- `skills/create-spine-tasks/references/contract-template.md`
- `skills/create-spine-tasks/references/requirements-checklist-template.md`

## Completion Criteria

- [ ] All steps complete
- [ ] Docs-only contract example includes fileScopeMustChange
- [ ] Definition of Ready checklist enforces the rule
- [ ] Issue #139 closed

## Git Commit Convention

- **Step completion:** `docs(SP-492): complete Step N — description`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Modify runtime spine code in this task
- Modify framework/standards docs outside skills/create-spine-tasks/
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
