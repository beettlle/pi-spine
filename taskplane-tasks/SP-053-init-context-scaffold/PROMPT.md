# Task: SP-053 — Scaffold CONTEXT.md on init (Phase D partial)

**Created:** 2026-06-02
**Size:** S

## Review Level: 0 (None)

## Mission

`spine init` creates `{tasksRoot}/CONTEXT.md` template with Next Task ID, phase table stub, execution policy pointer to operator runbook.

## Dependencies

- **SP-051**

## File Scope

- `bin/spine-init.mjs`, `templates/tasks/CONTEXT.md`
- `tests/spine-init.test.mjs`

## Steps

### Step 1: Template + init write

### Step 2: Tests

## Do NOT

- Auto-create task packets from PRD (SP-054)


## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(SP-051): default spine init`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
