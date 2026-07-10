# Task: SP-586 — Extract attached-runner-promote.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of attached-runner.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `attached-runner-promote.mjs` — attached batch promote/exit paths. Leave pause/resume reconcile for SP-604.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577
- **Task:** SP-603 (wave gate — batch prior second halves landed)

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/attached-runner-promote.mjs`
- `tests/batch/attached-batch-exit.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/attached-batch-exit.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner-promote.mjs`, `src/batch/attached-runner.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for attached-runner.mjs
- [ ] List public exports to preserve

### Step 1: Extract attached-runner-promote.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from attached-runner.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/attached-batch-exit.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-586): extract attached-runner-promote.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
