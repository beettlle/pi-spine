# Task: SP-078 — Error-path test hardening

**Created:** 2026-06-03
**Size:** M

## Review Level: 1 (Plan Only)

**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1

## Mission

Add negative/error-path tests for low-coverage critical modules: migrate CLI (~10%), slash handlers (~39%), integrate conflict recovery (~62%), evidence command rejection (after SP-072).

## Dependencies

- **Task:** SP-072

## File Scope

- `tests/migrate/spine-migrate.test.mjs` (new or extend)
- `tests/extensions/slash-commands.test.mjs` (new or extend)
- `tests/batch/integrate.test.mjs`
- `tests/batch/evidence.test.mjs`

## Steps

### Step 1: Migrate CLI tests
- [ ] CLI error paths for invalid/missing args

### Step 2: Slash + integrate tests
- [ ] Handler failure branches; integrate checkout/merge abort recovery

### Step 3: Testing & Verification
- [ ] Raise line coverage on target modules; FULL suite; coverage gate ≥77% repo-wide

## Do NOT
- Refactor production code except testability hooks

---

## Amendments (Added During Execution)
