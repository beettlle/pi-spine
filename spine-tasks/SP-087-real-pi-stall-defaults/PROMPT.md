# Task: SP-087 — Real-pi stall defaults and batch guidance

**Created:** 2026-06-04
**Size:** S

## Review Level: 1 (Plan Only)

**Score:** 3/8

## Mission

Make production `.spine/spine-config.json` include explicit long-running **stall** defaults (so dogfood repo is not on implicit 60m only), document recommended batch shapes for real `pi` workers, and add doctor/preflight **warnings** when `stallTimeoutMinutes` is unset and workers are not stubbed.

## Dependencies

- **Task:** SP-086 (sizing guidance complements stall policy)

## File Scope

- `templates/spine-config.json`
- `bin/spine-init.mjs`
- `.spine/spine-config.json` (this repo)
- `src/doctor/stall-config.mjs` (new)
- `src/batch/preflight.mjs` or `bin/spine-preflight.mjs` (warning hook)
- `docs/adoption/operator-runbook.md`
- `tests/doctor/stall-config.test.mjs` (new)

## Steps

### Step 1: Config defaults

- [ ] Add `lanes.stallTimeoutMinutes` (120), `stallGraceAfterProgressMinutes` (30), `heartbeatIntervalMinutes` (10) to template + init merge
- [ ] Update pi-spine `.spine/spine-config.json` with same

### Step 2: Doctor + preflight warnings

- [ ] Warn when `stallTimeoutMinutes` missing/≤60 and `SPINE_WORKER_STUB` not set
- [ ] Preflight soft-warning in plan output when starting 4+ pending M/L tasks

### Step 3: Testing & Verification

- [ ] Tests; FULL suite; coverage ≥77%
- [ ] Runbook § batch sizing + stall tuning

## Git Commit Convention

- `feat(SP-087): complete Step N — description`

---

## Amendments (Added During Execution)
