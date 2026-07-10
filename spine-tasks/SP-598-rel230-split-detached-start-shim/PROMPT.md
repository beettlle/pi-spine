# Task: SP-598 — Thin detached-start.mjs shim

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of detached-start.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Wire `detached-start.mjs` to `detached-spawn.mjs` + `detached-diagnostics.mjs`. Thin shim ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-580

## File Scope

- `src/batch/detached-start.mjs`
- `src/batch/detached-diagnostics.mjs`
- `tests/batch/detached-start-orphan-timeout.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/detached-start-orphan-timeout.test.mjs` |
| fileScopeMustChange | `src/batch/detached-start.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-580 complete

### Step 1: Complete split

- [ ] Move remainder; thin `detached-start.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/detached-start-orphan-timeout.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `detached-start.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-598): complete detached-start.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
