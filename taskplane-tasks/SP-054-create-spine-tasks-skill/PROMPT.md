# Task: SP-054 — create-spine-tasks skill (Phase D)

**Created:** 2026-06-02
**Size:** M

## Review Level: 1 (Plan Only)

## Mission

Add `skills/create-spine-tasks/SKILL.md` for decomposing PRD → spine task packets (adapt create-taskplane-task skill; spine-native naming, `spine-tasks/` paths).

## Dependencies

- **SP-051**, **SP-053**

## File Scope

- `skills/create-spine-tasks/**`
- `README.md`, `docs/adoption/bootstrap-checklist.md`

## Steps

### Step 1: Skill authoring

### Step 2: Bootstrap doc link + example

## Do NOT

- Require npm publish for skill to work locally


## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(SP-051): default spine init`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
