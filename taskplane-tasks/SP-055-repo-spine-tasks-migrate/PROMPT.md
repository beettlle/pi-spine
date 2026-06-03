# Task: SP-055 — Migrate pi-spine repo to spine-tasks/ (Phase C)

**Created:** 2026-06-02
**Size:** L

## Review Level: 2 (Plan + Code)

**Assessment:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Rename pi-spine dogfood folder `taskplane-tasks/` → `spine-tasks/`, update `.spine/spine-config.json`, fix all test paths. Optionally gitignore/remove stale `.pi/` Taskplane runtime artifacts from repo.

## Dependencies

- **SP-051**

## File Scope

- `taskplane-tasks/**` → `spine-tasks/**`
- `.spine/spine-config.json`, tests, CI, CONTEXT paths

## Steps

### Step 1: Move tasks root + config

### Step 2: Update test/fixture references

### Step 3: Purge or gitignore `.pi/` runtime cruft

### Step 4: Full test suite

## Do NOT

- Rename completed TP-* task IDs in folder names (optional follow-up)


## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(SP-051): default spine init`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
