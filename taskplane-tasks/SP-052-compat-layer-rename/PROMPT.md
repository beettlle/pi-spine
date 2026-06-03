# Task: SP-052 — Rename compat/taskplane module (Phase B)

**Created:** 2026-06-02
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Rename `src/compat/taskplane/` to spine-native naming (`src/tasks/packet/` or `src/compat/packet/`). Update imports and test file names. Keep `migrate-from-taskplane` CLI unchanged.

## Dependencies

- **SP-051**

## File Scope

- `src/compat/taskplane/**` → new path
- All importers, `tests/compat/taskplane-*.test.mjs`

## Steps

### Step 1: Move module + update imports

### Step 2: Rename tests + PRD wording

### Step 3: Full test suite

## Do NOT

- Remove migration CLI or Taskplane batch-state readers


## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(SP-051): default spine init`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
