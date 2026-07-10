# Task: SP-604 — Extract attached-runner-reconcile.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of attached-runner.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `attached-runner-reconcile.mjs` — `reconcilePausedResumeDoneInLane` and related reconcile paths. Thin shim ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-586

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/attached-runner-promote.mjs`
- `tests/batch/attached-pause-resume-sigterm.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/attached-pause-resume-sigterm.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner-reconcile.mjs`, `src/batch/attached-runner.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-586 complete

### Step 1: Complete split

- [ ] Move remainder; thin `attached-runner.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/attached-pause-resume-sigterm.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `attached-runner.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-604): complete attached-runner.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
