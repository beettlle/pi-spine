# Task: SP-556 — CI guard reconcile cwd tests

**Created:** 2026-07-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Static guard preventing reconcile tests from using real repo cwd.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Implement [#157](https://github.com/beettlle/pi-spine/issues/157): add CI guard (verify script or test meta-test) that fails when batch/reconcile test files pass `process.cwd()` as `projectRoot` without `initGitRepo()` / `destroyGitRepo()` fixture isolation.

**Closes:** [#157](https://github.com/beettlle/pi-spine/issues/157)

## Dependencies

- **Task:** SP-553

## File Scope

- `scripts/verify-reconcile-test-fixtures.mjs`
- `package.json`
- `tests/arch/reconcile-cwd-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/arch/reconcile-cwd-guard.test.mjs` |
| fileScopeMustChange | `scripts/verify-reconcile-test-fixtures.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #157 and fix commit `7e1e5b3` pattern
- [ ] Grep `tests/batch/reconcile*.test.mjs` for `process.cwd()` usage

### Step 1: Guard script

- [ ] Implement static scan for `projectRoot: process.cwd()` without fixture helpers
- [ ] Wire into `npm test` or `spine verify` pre-suite hook via `package.json`

### Step 2: Tests

- [ ] `reconcile-cwd-guard.test.mjs` — guard passes on current suite; fails on synthetic bad fixture

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Full suite green

### Step 4: Documentation & Delivery

- [ ] Link pattern in `tests/batch/reconcile.test.mjs` header comment
- [ ] Comment on #157
- [ ] Create `.DONE`

## Completion Criteria

- [ ] New reconcile tests using bare `process.cwd()` fail CI guard

## Git Commit Convention

- `feat(SP-556): CI guard for reconcile test cwd fixtures`

## Do NOT

- Rewrite all existing reconcile tests unless guard finds violations
