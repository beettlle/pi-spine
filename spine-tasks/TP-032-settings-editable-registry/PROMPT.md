# Task: TP-032 — Settings editable-field registry

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-032-settings-editable-registry/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Create a **pure registry** of FR-CFG-03 editable spine-config fields so show/set/TUI tasks share one validation source.

Deliverables:
1. **`src/config/settings-fields.mjs`** — catalog of editable paths with `{ path, label, type, min?, max?, enum? }` for at least:
   - `lanes.maxParallel`
   - `gates.requireBeforeIntegrate`
   - `agents.worker.model` (string, optional)
   - `agents.worker.thinking` (enum if applicable)
   - `dashboard.port`
2. **`parseSettingPath(path)`** and **`validateSettingValue(path, value)`** — return `{ ok, error?, normalizedValue? }`
3. **Tests** — valid/invalid types, unknown path rejected, maxParallel bounds

**Out of scope:** writing config to disk; slash/CLI UX.

**Success:** registry imported by later TP-033/034; tests cover all registered fields.

## Dependencies

- **TP-030** — config schema stable

## Context to Read First

**Tier 2:** `taskplane-tasks/CONTEXT.md`, `docs/PRD.md` FR-CFG-03, §10.4 schema

**Tier 3:**
- `bin/spine-config.mjs` — `validateSpineConfig`
- `templates/spine-config.json` — default shape

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/config/settings-fields.mjs` (new)
- `tests/config/settings-fields.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read PRD §10.4 + `templates/spine-config.json`; list FR-CFG-03 fields to expose in v1.1
- [ ] Baseline tests

### Step 1: Registry + validators

> **Plan-review checkpoint**

- [ ] Implement `SETTINGS_FIELDS` array and helpers `listEditableFields()`, `validateSettingValue(path, rawValue)`
- [ ] Coerce JSON types (boolean/number/string) from CLI string input where safe
- [ ] `tests/config/settings-fields.test.mjs` — one test per field + unknown path

**Artifacts:** `src/config/settings-fields.mjs`, `tests/config/settings-fields.test.mjs`

### Step 2: Verification

- [ ] Full test suite green

## Completion Criteria

- [ ] Registry lists ≥5 editable paths with validators
- [ ] Tests pass; no filesystem writes in module

## Must Update

- `taskplane-tasks/CONTEXT.md` when Done

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not implement CLI or slash commands
- Do not persist config changes

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
