# Task: SP-719 — Wire tests/arch and tests/fs into npm test

**Created:** 2026-08-22
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CI ship-gate policy change; enables arch enforcement.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #263 — Add `tests/arch/*.test.mjs` and `tests/fs/*.test.mjs` to `TEST_GLOBS` and `package.json` test script. Remove `tests/arch` and `tests/fs` from `SUITE_DIR_ALLOWLIST`. Keep `tests/scripts/` on-demand.

## Dependencies

- **None**

## Context to Read First

- `scripts/coverage-policy.mjs` — `TEST_GLOBS`, `SUITE_DIR_ALLOWLIST`
- `package.json` — `"test"` script
- `tests/coverage/policy.test.mjs`
- `tests/arch/import-cycles.test.mjs`
- GitHub #263, #267

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `scripts/coverage-policy.mjs`
- `package.json`
- `tests/coverage/policy.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/coverage/policy.test.mjs tests/arch/import-cycles.test.mjs` |
| fileScopeMustChange | `scripts/coverage-policy.mjs` |

## Steps

### Step 1: Update coverage policy

- [ ] Add arch/fs globs to `TEST_GLOBS`
- [ ] Remove arch/fs from `SUITE_DIR_ALLOWLIST`

### Step 2: Align package.json test script

- [ ] Ensure default `npm test` includes arch/fs globs (match policy comment)

### Step 3: Testing & Verification

- [ ] `tests/coverage/policy.test.mjs` passes
- [ ] `tests/arch/import-cycles.test.mjs` runs and passes (allowlisted cycles OK for now)
- [ ] Run contract `testCommand` only

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — test suite layout if documented

## Completion Criteria

- [ ] `npm test` executes arch and fs suites
- [ ] Policy test passes bidirectional parity
- [ ] `tests/scripts/` still excluded
- [ ] Closes #263

## Do NOT

- Break allowlisted import cycles in this task (#267 is separate)
- Wire `tests/scripts/` into default CI
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-719): wire tests/arch and tests/fs into default npm test (#263)`
