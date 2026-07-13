# Task: SP-650 — Wrong-cwd CLI surfaces

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Shared hint helper + several CLI/preflight call sites; adapts existing suggestedCommand pattern.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#202](https://github.com/beettlle/pi-spine/issues/202) (with SP-649)

Extract a small shared helper for missing-config hints (cwd + “cd to project root or spine init”). Wire `bin/spine-plan.mjs`, `bin/spine-tasks.mjs`, and missing-config branches in `src/config/preflight/discovery.mjs` that hardcode `suggestedCommand: "spine init"`. Optionally refactor `spine-config-load.mjs` to call the same helper so wording stays one source of truth.

## Dependencies

- **Task:** SP-649 (load-path message exists)

## Context to Read First

- GitHub issue #202
- `spine-tasks/SP-649-wrong-cwd-config-missing-message/PROMPT.md`
- `bin/spine-plan.mjs`, `bin/spine-tasks.mjs`
- `src/config/preflight/discovery.mjs`
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md` § FR-REL270-02

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/missing-config-hint.mjs`
- `src/config/spine-config-load.mjs`
- `src/config/preflight/discovery.mjs`
- `bin/spine-plan.mjs`
- `bin/spine-tasks.mjs`
- `tests/config/wrong-cwd-cli-surfaces.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/config/wrong-cwd-config-message.test.mjs tests/config/wrong-cwd-cli-surfaces.test.mjs` |
| fileScopeMustChange | `src/config/missing-config-hint.mjs`, `tests/config/wrong-cwd-cli-surfaces.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Inventory hard-coded `suggestedCommand: "spine init"` for missing-config cases
- [ ] Confirm SP-649 message shape to reuse

### Step 1: Shared helper + wire surfaces

- [ ] Add `src/config/missing-config-hint.mjs` (message + suggestedCommand)
- [ ] Wire plan/tasks CLIs and discovery missing-config paths
- [ ] Refactor load path to use helper if still duplicated

### Step 2: Testing & Verification

- [ ] Add `tests/config/wrong-cwd-cli-surfaces.test.mjs`
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`
- [ ] Close GitHub issue #202 (`gh issue close 202`) when criteria met

## Documentation Requirements

**Must Update:**
- None (narrative in SP-654)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-654

## Completion Criteria

- [ ] #202 closable — plan/tasks/discovery missing-config hints include cwd
- [ ] Shared helper is single source of truth
- [ ] Scoped tests green

## Do NOT

- Change evidence-command or templates (SP-651/653)
- Auto-walk parent directories for config (out of scope)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-650): shared wrong-cwd missing-config hint for CLI surfaces (#202)`
