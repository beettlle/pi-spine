# Task: SP-648 — PATH spine version skew warn

**Created:** 2026-07-13
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Doctor/version skew warning; extend existing duplicate-install patterns.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

**Closes:** [#204](https://github.com/beettlle/pi-spine/issues/204)

When the running CLI package version differs from the checkout `package.json` version (PATH global vs dogfood checkout), `spine version` and/or `spine doctor` must warn so operators use `node bin/spine.mjs` / `npm link` instead of a stale global binary. Prefer extending [`src/doctor/duplicate-install.mjs`](../../src/doctor/duplicate-install.mjs) / version printing in `bin/spine.mjs` rather than a new subsystem.

## Dependencies

- **None**

## Context to Read First

- `bin/spine.mjs` — version print
- `src/doctor/duplicate-install.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/duplicate-install.test.mjs`
- GitHub #204

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine.mjs`
- `src/doctor/duplicate-install.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `tests/doctor/duplicate-install.test.mjs` (or new focused skew test)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/duplicate-install.test.mjs` |
| fileScopeMustChange | `src/doctor/duplicate-install.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm current duplicate-install / version print behavior
- [ ] Define skew detection (running pkg vs cwd package.json when present)

### Step 1: Warn on PATH vs checkout skew

- [ ] Detect runnable CLI version ≠ checkout `package.json` version
- [ ] Surface warn on `spine doctor` and/or `spine version`
- [ ] Suggested remediation: `node bin/spine.mjs` or `npm link`

### Step 2: Testing & Verification

- [ ] Unit/fixture for skew warn path
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (narrative in SP-641)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641

## Completion Criteria

- [ ] #204 closable
- [ ] Skew warn path covered by test

## Do NOT

- Change worker spawn package resolution
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-648): warn when PATH spine version skews checkout (#204)`
