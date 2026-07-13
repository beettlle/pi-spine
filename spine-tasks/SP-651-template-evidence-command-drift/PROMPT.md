# Task: SP-651 — Template evidence command drift

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Template + regression test against existing evidence validator; low blast radius.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

`templates/spine-config.json` sets `testing.build` / `testing.test` to `npm run typecheck && npm test`, which today’s evidence parser rejects (shell metacharacters). Change template `testing.*` to Phase-A-safe values (single allowlisted argv such as `npm run typecheck` / `npm test`, or a `scripts/` path). Add a regression test that every template `testing.*` string passes the evidence validator so drift cannot return unnoticed before Phase B (SP-653) optionally re-enables `&&`.

## Dependencies

- **None**

## Context to Read First

- `templates/spine-config.json`
- `src/batch/evidence-command.mjs`
- `docs/PRD-v2.7.0-operator-ux-evidence-handoff.md` § FR-REL270-03
- GitHub #160 Phase A context (scripts/ already shipped)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `templates/spine-config.json`
- `tests/config/template-evidence-commands.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/config/template-evidence-commands.test.mjs` |
| fileScopeMustChange | `templates/spine-config.json`, `tests/config/template-evidence-commands.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm template `testing.build` / `testing.test` fail current evidence parse
- [ ] Choose Phase-A-safe replacements (prefer split allowlisted commands)

### Step 1: Fix template + regression test

- [ ] Update `templates/spine-config.json` testing commands to validator-safe values
- [ ] Add `tests/config/template-evidence-commands.test.mjs` asserting all template testing commands parse/validate

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (narrative in SP-654; SP-653 may restore `&&` after Phase B)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-654
- `docs/stet-overview.md` — only if evidence examples cite template

## Completion Criteria

- [ ] Template testing commands pass evidence validator
- [ ] Regression test fails if `&&` returns before Phase B lands

## Do NOT

- Implement Phase B chain support here (SP-653)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Change project `.spine/spine-config.json` unless required for dogfood (prefer template only)

## Git Commit Convention

- `fix(SP-651): align template testing commands with evidence validator`
