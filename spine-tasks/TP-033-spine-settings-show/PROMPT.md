# Task: TP-033 — spine settings show CLI

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-033-spine-settings-show/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement **`spine settings show`** — read-only display of spine-config editable fields (foundation for `/spine-settings`).

Deliverables:
1. **`spine settings show [path] [--json]`** — load config via `loadSpineConfig`; without path print all editable fields (from TP-032 registry) with current values; with path print single value
2. **JSON mode** — `{ fields: [{ path, label, value, type }] }` or `{ path, value }`
3. **Errors** — missing config → exit 1 + `suggestedCommand: spine init`

**Success:** `spine settings show` prints lanes/gates/agents/dashboard fields from live config; tests use temp config fixture.

## Dependencies

- **TP-032** — editable field registry

## Context to Read First

**Tier 3:** `src/config/settings-fields.mjs`, `bin/spine-config.mjs`, `bin/spine.mjs` router pattern

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/cli/settings-show.mjs` (new)
- `bin/spine-settings.mjs` (new — show subcommand)
- `bin/spine.mjs` — `settings` command group
- `tests/spine-settings-show.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Confirm TP-032 registry exports; baseline tests

### Step 1: Show implementation

> **Plan-review checkpoint**

- [ ] `formatSettingsShow(config, { path?, json? })` in `src/cli/settings-show.mjs`
- [ ] CLI wiring + help: `spine settings show [path] [--json]`
- [ ] Tests: temp `.spine/spine-config.json`; single-path mode; missing config error

**Artifacts:** `src/cli/settings-show.mjs`, `bin/spine-settings.mjs`, `tests/spine-settings-show.test.mjs`

### Step 2: Verification

- [ ] Full suite green; manual `spine settings show` on repo

## Completion Criteria

- [ ] Show all + single path + JSON modes work
- [ ] Tests pass

## Must Update

- `bin/spine.mjs` help text

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not write config
- Do not implement slash UI (TP-035)

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
