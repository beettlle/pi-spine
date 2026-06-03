# Task: SP-051 — Default spine init + docs rebrand (Phase A)

**Created:** 2026-06-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Make **greenfield** spine projects use `spine init` without Taskplane-branded flags. Fold preset defaults into plain init; keep `--preset taskplane-compat` as deprecated alias for migrants.

Deliverables:
1. **`applySpineInitDefaults`** — testing commands, gates, dashboard port, lanes on every init
2. **Default tasks root** — `spine-tasks/` (unchanged); `taskplane-compat` preset only changes default root to `taskplane-tasks`
3. **Docs** — README, adoption docs, help text use `spine init` not `taskplane-compat` combo
4. **CLI suggestedCommand** — `spine init` in preflight/config/plan errors
5. **Tests** — plain init has full defaults; legacy preset alias still works

**Success:** New user runs `spine init` + `spine doctor` only; docs never require taskplane-compat for greenfield.

## Dependencies

- **None**

## Context to Read First

**Tier 3:** `bin/spine-init.mjs`, `docs/adoption/bootstrap-checklist.md`, `README.md`

## File Scope

- `bin/spine-init.mjs`
- `bin/spine-preflight.mjs`, `bin/spine-config.mjs`, `bin/spine-plan.mjs`, `bin/spine.mjs`
- `docs/adoption/*.md`, `README.md`
- `scripts/stub-free-dogfood.sh`, `scripts/real-pi-adoption-e2e.sh`
- `tests/spine-init.test.mjs`, `tests/spine-init-preset.test.mjs`
- `tests/fixtures/adoption-repo/README.md`

## Steps

### Step 1: Init defaults refactor

> **Plan-review checkpoint**

- [ ] `applySpineInitDefaults`; call from all inits
- [ ] `--preset taskplane-compat` deprecated alias (default root taskplane-tasks)

### Step 2: Docs + suggestedCommand sweep

- [ ] Adoption docs, README, help text
- [ ] Replace `spine init --tasks-root taskplane-tasks` in suggestedCommand

### Step 3: Tests + verification

> **Code review checkpoint**

- [ ] Tests for default init + legacy preset
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Plain `spine init` produces gates/testing/lanes defaults on `spine-tasks/`
- [ ] Docs greenfield path is `spine init` only
- [ ] Tests pass

## Must Update

- `README.md`, `docs/adoption/bootstrap-checklist.md`, `docs/adoption/local-install.md`, `docs/adoption/operator-runbook.md`

## Do NOT

- Rename `src/compat/taskplane/` (SP-052)
- Move pi-spine `taskplane-tasks/` folder (SP-055)


## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(SP-051): default spine init`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
