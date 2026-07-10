# Task: SP-599 — Extract worker-heartbeat.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Second half of worker-host.mjs bisection — thin shim ≤500 LOC.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `worker-heartbeat.mjs` — polling, stall detection, heartbeat. Thin `worker-host.mjs` ≤500 LOC.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-581

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/worker-spawn.mjs`
- `tests/batch/worker-host.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/worker-host.test.mjs` |
| fileScopeMustChange | `src/batch/worker-heartbeat.mjs`, `src/batch/worker-host.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-581 complete

### Step 1: Complete split

- [ ] Move remainder; thin `worker-host.mjs` ≤500 LOC
- [ ] Preserve all public exports via re-export

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/worker-host.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] `worker-host.mjs` ≤500 LOC; API unchanged

## Git Commit Convention

- `refactor(SP-599): complete worker-host.mjs split`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
