# Task: SP-114 — Coverage TEST_GLOBS parity with npm test

**Created:** 2026-06-05
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** coverage:check runs 555 tests vs 559 — agents drift tests skipped in CI gate.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Add `tests/agents/*.test.mjs` to `scripts/coverage-policy.mjs` TEST_GLOBS. Add bidirectional parity test in `tests/coverage/policy.test.mjs`.

**Source:** SP-108 Finding F1 (HIGH).

## Dependencies

- **None**

## File Scope

- `scripts/coverage-policy.mjs`
- `tests/coverage/policy.test.mjs`

## Steps

### Step 1: Align globs
- [ ] Add agents glob; verify coverage:check runs 559 tests
- [ ] Bidirectional test: npm test globs ⊆ coverage globs and vice versa

### Step 2: Testing & Verification
- [ ] `npm run coverage:check` passes with full count

## Completion Criteria
- [ ] coverage:check test count matches npm test

## Git Commit Convention
- `fix(SP-114): include agents tests in coverage gate globs`

## Do NOT
- Change 77% threshold

---

## Amendments (Added During Execution)
