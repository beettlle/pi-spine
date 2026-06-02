# Task: TP-035 — /spine-settings interactive menu

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-035-spine-settings-slash/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Wire **`/spine-settings`** (FR-CFG-03) as an operator-friendly menu that surfaces editable fields and guides changes via `spine settings` CLI (v1.1 menu-first; full TUI optional stretch).

Deliverables:
1. **`extensions/spine/settings-slash.ts`** — `runSpineSettingsSlash(ctx, args)`:
   - Load config + registry; `ctx.ui.notify` formatted field list with current values
   - For each field, show suggested command: `spine settings set <path> <value>`
   - Optional: parse `/spine-settings set lanes.maxParallel 2` subcommand delegating to set core
2. **Replace stub** in `slash-commands.ts` with handler import
3. **Tests** — mock ExtensionCommandContext; assert notify payload includes ≥5 fields

**Out of scope:** ncurses/full-screen TUI; model picker with live pi provider list (document as v1.2).

**Success:** `/spine-settings` shows live config fields; README marks implemented.

## Dependencies

- **TP-034** — settings set CLI
- **TP-033** — settings show CLI

## Context to Read First

**Tier 3:** `extensions/spine/slash-commands.ts`, `src/cli/settings-show.mjs`, `src/config/settings-fields.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `extensions/spine/settings-slash.ts` (new)
- `extensions/spine/slash-commands.ts` — wire handler
- `tests/spine-settings-slash.test.mjs` (new)
- `README.md`

## Steps

### Step 0: Preflight

- [ ] Review other slash handlers (`spineStatusHandler`) for notify patterns; baseline tests

### Step 1: Settings slash module

> **Plan-review checkpoint**

- [ ] Implement menu formatter + optional inline `set` parsing
- [ ] Wire handler; remove stub message for `spine-settings`
- [ ] Static test with mock pi context

**Artifacts:** `extensions/spine/settings-slash.ts`, `tests/spine-settings-slash.test.mjs`

### Step 2: Verification

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Manual `/spine-settings` in pi (log in STATUS if unavailable)

## Completion Criteria

- [ ] Stub replaced; menu lists editable fields
- [ ] Tests + typecheck pass

## Must Update

- `README.md` — FR-CFG-03 status

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not duplicate set logic — call shared modules
- Do not build full-screen TUI in this task

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
