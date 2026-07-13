# Task: SP-649 — Wrong-cwd config missing message

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single-module config load error messaging; low novelty.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

**Partial:** [#202](https://github.com/beettlle/pi-spine/issues/202)

When `loadSpineConfig` fails because `.spine/spine-config.json` is missing, the error message and `suggestedCommand` must include the resolved project directory (cwd/`$PWD`) and tell operators to change to their project root **or** run `spine init` here — not bare `spine init` alone.

## Dependencies

- **None**

## Context to Read First

- GitHub issue #202
- `src/config/spine-config-load.mjs`
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md` § FR-REL270-01
- `spine-tasks/CONTEXT.md` Phase 71

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/spine-config-load.mjs`
- `tests/config/wrong-cwd-config-message.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/config/wrong-cwd-config-message.test.mjs` |
| fileScopeMustChange | `src/config/spine-config-load.mjs`, `tests/config/wrong-cwd-config-message.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm missing-config branch in `spine-config-load.mjs`
- [ ] Reproduce bare `suggestedCommand: "spine init"` today

### Step 1: Honest missing-config message

- [ ] Include resolved project root / `$PWD` in error message
- [ ] Suggest cd-to-root **or** `spine init` (not bare init alone)
- [ ] Keep fail-closed behavior when config is truly absent

### Step 2: Testing & Verification

- [ ] Add `tests/config/wrong-cwd-config-message.test.mjs` covering message + suggestedCommand
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command
- [ ] Coverage gate (code change): `npm run coverage:check` (≥77% line coverage)

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (narrative in SP-654)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-654

## Completion Criteria

- [ ] Missing-config load path mentions cwd and dual remediation
- [ ] Scoped test green

## Do NOT

- Widen to full parent-directory auto-discovery (optional #202 idea — out of scope)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Change evidence-command or template files (SP-651/653)

## Git Commit Convention

- `fix(SP-649): honest missing-config message with cwd (#202)`
