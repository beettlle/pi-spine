# Task: TP-034 — spine settings set CLI

**Created:** 2026-06-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Canonical Task Folder

```
taskplane-tasks/TP-034-spine-settings-set/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Implement **`spine settings set <path> <value>`** with atomic config write and validation (FR-CFG-03 backend).

Deliverables:
1. **`spine settings set <path> <value> [--dry-run] [--json]`** — validate via TP-032; merge into config object; run `validateSpineConfig` on result; write atomically (tmp + rename) unless `--dry-run`
2. **Refuse** unknown paths and invalid values with actionable errors
3. **Tests** — set maxParallel; reject bad value; dry-run leaves file unchanged

**Success:** operator can `spine settings set lanes.maxParallel 2` and `spine settings show` reflects change.

## Dependencies

- **TP-033** — settings show CLI
- **TP-032** — field validators

## Context to Read First

**Tier 3:** `src/config/settings-fields.mjs`, `src/cli/settings-show.mjs`, `bin/spine-init.mjs` write patterns

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## File Scope

- `src/cli/settings-set.mjs` (new)
- `bin/spine-settings.mjs` — add `set` subcommand
- `tests/spine-settings-set.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read atomic write pattern from init/migrate CLIs; baseline tests

### Step 1: Set implementation

> **Plan-review checkpoint**

- [ ] `applySetting(config, path, value)` pure merge using dotted paths
- [ ] `writeSpineConfigAtomic(projectRoot, config)` helper (or reuse existing if present)
- [ ] CLI + tests for dry-run and successful write

**Artifacts:** `src/cli/settings-set.mjs`, `tests/spine-settings-set.test.mjs`

### Step 2: Verification

> **Code review checkpoint**

- [ ] Full suite green
- [ ] Manual round-trip: set → show on temp dir

## Completion Criteria

- [ ] Set + dry-run + validation errors tested
- [ ] Full suite green

## Must Update

- `README.md` — document `spine settings` subcommands

## Check If Affected

- `docs/PRD.md` — only if behavior diverges from spec
- `bin/spine.mjs` help text

## Do NOT

- Do not implement interactive TUI (TP-035)
- Do not modify non-editable config keys silently

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-031): spine deps CLI`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
