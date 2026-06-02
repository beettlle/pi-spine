# Task: TP-046 — FR-CFG-04 environment overrides

**Created:** 2026-06-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement PRD **FR-CFG-04**: environment variable overrides for `SPINE_TASKS_ROOT` and `SPINE_MAX_LANES` (maps to config `tasks.root` and `lanes.maxParallel`).

Deliverables:
1. **Config loader** — apply env overrides after file load with documented precedence (env > file > defaults)
2. **CLI visibility** — `spine settings show` and doctor list effective values + source
3. **Tests** — `tests/config/env-overrides.test.mjs`
4. **Docs** — bootstrap-checklist + settings-fields registry note

**Success:** `SPINE_TASKS_ROOT=/alt/path spine plan pending` discovers tasks under alt root.

## Dependencies

- **TP-043** — adoption path docs mention env overrides

## Context to Read First

**Tier 3:** `src/config/`, `src/config/settings-fields.mjs`, PRD FR-CFG-04

## File Scope

- `src/config/*.mjs`
- `src/cli/settings-show.mjs`
- `tests/config/env-overrides.test.mjs` (new)
- `docs/adoption/bootstrap-checklist.md`

## Steps

### Step 1: Env override implementation

> **Plan-review checkpoint**

- [ ] SPINE_TASKS_ROOT, SPINE_MAX_LANES parsing + validation
- [ ] Wire into config load used by plan/batch/doctor

### Step 2: Visibility + docs

- [ ] settings show / doctor effective values
- [ ] Document in bootstrap checklist

### Step 3: Verification

- [ ] env-overrides tests
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Both env vars work
- [ ] Tests pass

## Do NOT

- Do not add unlisted env vars beyond FR-CFG-04 without PRD update

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
