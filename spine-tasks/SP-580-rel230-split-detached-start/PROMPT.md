# Task: SP-580 — Extract detached-diagnostics.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of detached-start.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `detached-diagnostics.mjs` (failure collection, log paths, argv builders). Keep `startBatchDetached` in `detached-start.mjs` for SP-598. `detached-spawn.mjs` already exists.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577

## File Scope

- `src/batch/detached-start.mjs`
- `src/batch/detached-diagnostics.mjs`
- `tests/batch/detached-start-orphan-timeout.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/detached-start-orphan-timeout.test.mjs` |
| fileScopeMustChange | `src/batch/detached-diagnostics.mjs`, `src/batch/detached-start.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for detached-start.mjs
- [ ] List public exports to preserve

### Step 1: Extract detached-diagnostics.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from detached-start.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/detached-start-orphan-timeout.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-580): extract detached-diagnostics.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
