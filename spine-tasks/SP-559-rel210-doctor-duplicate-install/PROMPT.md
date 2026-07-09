# Task: SP-559 — spine doctor duplicate install detection

**Created:** 2026-07-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Diagnostic-only doctor enhancements.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement [#128](https://github.com/beettlle/pi-spine/issues/128):

1. Detect duplicate pi-spine installs (`~/.pi/agent/npm` vs global npm) with version divergence
2. Resolve Pi CLI via `process.argv[1]` with NVM/Nix fallbacks

**Closes:** [#128](https://github.com/beettlle/pi-spine/issues/128)

## Dependencies

- **Task:** SP-553

## File Scope

- `src/doctor/duplicate-install.mjs`
- `src/doctor/pi-cli-resolution.mjs`
- `bin/spine-doctor.mjs`
- `tests/doctor/duplicate-install.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/doctor/duplicate-install.test.mjs` |
| fileScopeMustChange | `bin/spine-doctor.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #128 and Taskplane path-resolver reference

### Step 1: Duplicate install check

- [ ] Compare pi-private vs npm-global spine versions
- [ ] Print remediation steps when diverged

### Step 2: argv Pi CLI resolution

- [ ] Resolve authoritative pi path from `process.argv[1]`
- [ ] Document in doctor output when PATH differs

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Full suite green

### Step 4: Documentation & Delivery

- [ ] Update operator runbook doctor section
- [ ] Comment on #128
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `spine doctor` reports duplicate installs and resolved pi path

## Git Commit Convention

- `feat(SP-559): doctor duplicate install and pi CLI resolution`

## Do NOT

- Change runtime batch behavior
