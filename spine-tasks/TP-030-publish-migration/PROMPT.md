# Task: TP-030 — Publish prep + Taskplane migration CLI (v1.0 tail)

**Created:** 2026-06-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Ships migration/preset CLIs referenced throughout README and PRD §22; adds npm publish metadata and release checklist. Touches init, config, CLI routing, and package manifest.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-030-publish-migration/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Close the **v1.0 publish/migration tail** deferred from TP-029 so operators can migrate from Taskplane and install from npm without doc/CLI drift:

1. **`spine migrate-from-taskplane`** (PRD §22.2, §15.2) — read `.pi/taskplane-config.json` (or `--source PATH`), map fields to `.spine/spine-config.json`, dry-run + write modes, journal-safe (no batch mutation).
2. **`spine init --preset taskplane-compat`** (FR-INIT-05) — sets `paths.tasksRoot`, testing commands, lane defaults, and dashboard port suitable for Taskplane migrants; composable with `--tasks-root`.
3. **npm publish readiness** — add `LICENSE` (MIT), `package.json` `repository`/`homepage`/`bugs`, verify `files` whitelist, add `prepublishOnly` or document release script; **do not** publish without explicit operator approval (document steps in release checklist).
4. **README + help alignment** — ensure documented commands exist; fix slash-command stub table; migration quick start matches implemented CLIs.
5. **Release checklist doc** — `docs/release/v1.0-checklist.md`: npm publish, `pi install npm:pi-spine` smoke, pi.dev listing fields, post-publish verification.

**Out of scope:** `/spine-settings` TUI (FR-CFG-03, v1.1), worker MCP tools (`spine_report_progress`), actual npm publish execution (operator runs after review), pi-subagents backend.

**Success:** `spine migrate-from-taskplane --dry-run` and `spine init --preset taskplane-compat --dry-run` work on this repo's fixtures; migration + preset covered by tests; release checklist complete; full test suite green.

## Dependencies

- **TP-029** — Phase 6 compatibility validation complete (dogfood report signed off)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md`
- `docs/PRD.md` — §22 Migration, FR-INIT-05, §15.2 CLI table

**Tier 3:**
- `.pi/taskplane-config.json` — real Taskplane config in this repo
- `templates/spine-config.json`, `bin/spine-init.mjs`, `bin/spine-config.mjs`
- `bin/spine.mjs` — command router pattern (`cmdInit`, `cmdDoctor`, …)
- `README.md` — migration section (currently references unimplemented commands)
- `taskplane-tasks/TP-002-spine-init/PROMPT.md` — FR-INIT-05 note

## Environment

- **Workspace:** pi-spine repo root
- **Fixtures:** use repo `.pi/taskplane-config.json` + temp dirs for write tests

## File Scope

- `bin/spine-migrate-from-taskplane.mjs` (new)
- `bin/spine-init.mjs` — `--preset taskplane-compat`
- `bin/spine.mjs` — register `migrate-from-taskplane` subcommand + help text
- `src/migrate/taskplane-config.mjs` (new — field mapping pure functions)
- `tests/migrate/taskplane-config.test.mjs` (new)
- `tests/spine-init-preset.test.mjs` (new or extend existing init tests)
- `LICENSE` (new)
- `package.json`
- `docs/release/v1.0-checklist.md` (new)
- `README.md`
- `taskplane-tasks/CONTEXT.md`
- `taskplane-tasks/dependencies.json`

## Steps

### Step 0: Preflight

- [ ] Confirm TP-029 `.DONE` and `docs/compatibility/phase6-dogfood-report.md` exist (or note blocker in STATUS Amendments)
- [ ] Read PRD §22.2 field mapping table; inventory Taskplane keys in `.pi/taskplane-config.json`
- [ ] Baseline: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 1: Taskplane → spine config mapper

> **Plan-review checkpoint**

- [ ] Add `src/migrate/taskplane-config.mjs` with pure functions:
  - `loadTaskplaneConfig(sourcePath)` — parse JSON; fail loud on missing file
  - `mapTaskplaneToSpine(taskplaneConfig, { tasksRootOverride? })` → spine config object (configVersion 1)
  - **Minimum mappings (PRD §22.2):**
    - `taskRunner.paths.tasks` → `paths.tasksRoot`
    - `taskRunner.testing.commands.unit|build|test` → `testing.test` / `testing.build` (sensible fallbacks)
    - `orchestrator.orchestrator.maxLanes` → `lanes.maxParallel` (cap sanity)
    - `taskRunner.project.name|description` → `project.name|description` when present
  - Preserve unmapped spine defaults from template for agents, gates, dashboard
- [ ] `tests/migrate/taskplane-config.test.mjs` — golden map from repo fixture; unknown keys ignored; maxLanes mapping

**Artifacts:**
- `src/migrate/taskplane-config.mjs` (new)
- `tests/migrate/taskplane-config.test.mjs` (new)

### Step 2: CLI — migrate + preset init

> **Code review checkpoint**

- [ ] `bin/spine-migrate-from-taskplane.mjs`:
  - Usage: `spine migrate-from-taskplane [--source PATH] [--dry-run] [--force]`
  - Default source: `.pi/taskplane-config.json`
  - `--dry-run`: print merged spine JSON to stdout (no write)
  - Write: `.spine/spine-config.json` (refuse overwrite unless `--force`; validate with `validateSpineConfig`)
  - Exit 0 on success; actionable errors with `suggestedCommand`
- [ ] Wire into `bin/spine.mjs` help + `case "migrate-from-taskplane"`
- [ ] `bin/spine-init.mjs`: parse `--preset taskplane-compat`
  - Sets tasksRoot default `taskplane-tasks` when preset set (unless `--tasks-root` overrides)
  - Seeds testing commands from preset template fragment (e.g. `npm run typecheck && npm test`)
  - Sets `dashboard.port` 8109, `gates.requireBeforeIntegrate` true
- [ ] Tests: dry-run migrate on fixture; init preset writes expected keys in temp dir

**Artifacts:**
- `bin/spine-migrate-from-taskplane.mjs` (new)
- `bin/spine-init.mjs`, `bin/spine.mjs` (modified)
- `tests/migrate/*.test.mjs`, init preset tests

### Step 3: npm publish metadata + release checklist

- [ ] Add `LICENSE` (MIT, match README intent)
- [ ] Update `package.json`:
  - `repository`, `homepage`, `bugs` → `github.com/beettlle/pi-spine` (or actual remote from `git remote -v`)
  - Confirm `files` array includes shipped dirs; no test/dev leakage
  - Optional: `"scripts": { "prepublishOnly": "npm run typecheck && npm test" }`
- [ ] Create `docs/release/v1.0-checklist.md`:
  - Version bump policy (0.0.1 → 0.1.0 or 1.0.0 — operator decision)
  - `npm pack` / `npm publish --access public` steps
  - Post-publish: `pi install npm:pi-spine`, `spine doctor`, `/spine` visible
  - pi.dev package page fields (description, keywords, minPiVersion)
  - **Explicit:** publishing requires human approval; this task prepares only
- [ ] Update npm test script if new test dirs added (`tests/migrate/*.test.mjs`)

**Artifacts:**
- `LICENSE`, `package.json`, `docs/release/v1.0-checklist.md`

### Step 4: Docs + CONTEXT

- [ ] README migration section: commands match implementation; remove "see migrate" if now real
- [ ] Fix slash-command table — mark implemented vs stub accurately (`/spine-settings`, `/spine-deps` remain stubs)
- [ ] `spine help` lists `migrate-from-taskplane`
- [ ] CONTEXT.md: Phase 7 row TP-030 Done; clear FR-INIT-05 deferred note; `Next Task ID: TP-031`

### Step 5: Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Manual smoke:
  - `spine migrate-from-taskplane --dry-run --source .pi/taskplane-config.json`
  - `spine init --preset taskplane-compat --tasks-root taskplane-tasks --dry-run`
  - `npm pack` succeeds; inspect tarball contents vs `files` whitelist
- [ ] `spine preflight` on clean committed tree

## Completion Criteria

- [ ] `spine migrate-from-taskplane` and `--preset taskplane-compat` implemented and tested
- [ ] LICENSE + package.json publish metadata present
- [ ] `docs/release/v1.0-checklist.md` complete
- [ ] README/help aligned with implemented CLIs
- [ ] Full test suite green; no regression to init/doctor/preflight

## Must Update

- `README.md`
- `docs/release/v1.0-checklist.md`
- `taskplane-tasks/CONTEXT.md`
- `package.json`

## Check If Affected

- `docs/PRD.md` — optional FR-INIT-05 status note
- `pi-spine-PRD.md` — keep in sync if editing PRD

## Git Commit Convention

- `feat(TP-030): complete Step N — description`

## Do NOT

- Run `npm publish` or create GitHub Release without explicit operator request
- Auto-overwrite operator `.spine/spine-config.json` without `--force`
- Implement `/spine-settings` TUI or worker MCP tools in this task
- Commit `*.tgz` pack artifacts

---

## Amendments (Added During Execution)
