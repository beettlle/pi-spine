# Task: TP-002 — Implement spine init and templates

**Created:** 2026-05-31
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** New CLI command with file scaffolding, config schema, and gitignore mutation across multiple modules.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-002-spine-init/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Implement `spine init` so a consumer project can scaffold `.spine/spine-config.json`, composable agent stubs, and gitignore entries — satisfying FR-INIT-01 through FR-INIT-04 and success metric M1 (`spine init && spine doctor` all green).

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3 (load only if needed):**
- `pi-spine-PRD.md` — §7.1 FR-INIT, §10.4 spine-config.json schema, §21.2 Install
- `bin/spine-config.mjs` — existing config validation (reuse, do not duplicate schema)
- `bin/spine.mjs` — existing doctor/help wiring
- `.pi/taskplane-config.json` — reference for default project name/tasks root in this repo

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine.mjs`
- `bin/spine-init.mjs` (new)
- `templates/**` (new)
- `tests/spine-init.test.mjs` (new)
- `package.json`

## Steps

### Step 0: Preflight

- [ ] Read PRD §7.1 and §10.4; confirm schema fields match `validateSpineConfig()` in `bin/spine-config.mjs`
- [ ] Read Taskplane `bin/taskplane.mjs` init flow for idioms (`--dry-run`, `--force`, idempotent re-run)

### Step 1: Create init templates

> **Plan-review checkpoint** — confirm template layout before wiring CLI.

- [ ] Add `templates/spine-config.json` matching PRD §10.4 with sensible defaults (`tasksRoot`: `spine-tasks`, `lanes.maxParallel`: 3)
- [ ] Add composable agent stubs under `templates/agents/{worker,reviewer,supervisor}.md` (comment headers only; mirror Taskplane style)
- [ ] Export template paths from a small helper in `bin/spine-init.mjs`

**Artifacts:**
- `templates/spine-config.json` (new)
- `templates/agents/worker.md` (new)
- `templates/agents/reviewer.md` (new)
- `templates/agents/supervisor.md` (new)

### Step 2: Implement spine init command

- [ ] Add `cmdInit()` in `bin/spine-init.mjs` and wire `init` subcommand in `bin/spine.mjs`
- [ ] Support flags: `--tasks-root PATH`, `--dry-run`, `--force` (overwrite existing config when forced)
- [ ] Create `.spine/spine-config.json` with `paths.tasksRoot` from flag or default `spine-tasks/`
- [ ] Copy agent stubs to `.spine/agents/{worker,reviewer,supervisor}.md` (skip if exist unless `--force`)
- [ ] Append missing spine gitignore entries (reuse `SPINE_GITIGNORE_ENTRIES` from `spine.mjs`; do not duplicate list)
- [ ] Update `printHelp()` to document `init` options
- [ ] Run targeted tests: `node --test tests/spine-init.test.mjs`

**Artifacts:**
- `bin/spine-init.mjs` (new)
- `bin/spine.mjs` (modified)

### Step 3: Add init tests

- [ ] Create `tests/spine-init.test.mjs` using Node test runner and a temp directory fixture
- [ ] Test: fresh init creates config + agents + gitignore entries
- [ ] Test: init without `--force` refuses when `.spine/spine-config.json` exists
- [ ] Test: `--tasks-root taskplane-tasks` sets `paths.tasksRoot` correctly
- [ ] Test: `--dry-run` makes no filesystem changes
- [ ] Add `"test": "node --test tests/*.test.mjs"` to `package.json` scripts

**Artifacts:**
- `tests/spine-init.test.mjs` (new)
- `package.json` (modified)

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Run init in a temp directory fixture; verify `node bin/spine.mjs doctor` exits 0 after init
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Update README.md install section with `spine init` usage
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — document `spine init`, flags, and post-init doctor expectation

**Check If Affected:**
- `pi-spine-PRD.md` — only if init behavior diverges from spec

## Completion Criteria

- [ ] `spine init` creates valid `.spine/spine-config.json` and agent stubs
- [ ] `spine init && spine doctor` exits 0 in a fresh fixture directory
- [ ] All tests passing and typecheck clean

## Git Commit Convention

- **Step completion:** `feat(TP-002): complete Step N — description`
- **Bug fixes:** `fix(TP-002): description`
- **Tests:** `test(TP-002): description`
- **Hydration:** `hydrate: TP-002 expand Step N checkboxes`

## Do NOT

- Implement `--preset taskplane-compat` (FR-INIT-05 — Phase 1)
- Implement batch engine, slash commands, or migration helper
- Modify `.pi/taskplane-config.json` or Taskplane runtime files
- Expand task scope — log follow-ups in CONTEXT.md

---

## Amendments (Added During Execution)
