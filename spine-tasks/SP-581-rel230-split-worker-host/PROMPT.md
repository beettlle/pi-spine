# Task: SP-581 — Extract worker-spawn.mjs

**Created:** 2026-07-10
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** First half of worker-host.mjs bisection per FR-SHIP-02.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract `worker-spawn.mjs` — child process setup, env, output streaming. Leave heartbeat/stall in `worker-host.mjs` for SP-599.

**Closes:** partial #117

> **Grandfather list:** Do not edit `bin/spine-cli/verify.mjs` — SP-593.

## Dependencies

- **Task:** SP-577

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/worker-spawn.mjs`
- `tests/batch/worker-host-env.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `node --test tests/batch/worker-host-env.test.mjs` |
| fileScopeMustChange | `src/batch/worker-spawn.mjs`, `src/batch/worker-host.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read explore findings for worker-host.mjs
- [ ] List public exports to preserve

### Step 1: Extract worker-spawn.mjs

- [ ] Create module ≤500 LOC
- [ ] Re-export from worker-host.mjs

### Step 2: Testing & Verification

- [ ] `node --test tests/batch/worker-host-env.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] First-half extract complete; second half deferred to paired task

## Git Commit Convention

- `refactor(SP-581): extract worker-spawn.mjs`

## Do NOT

- Edit `bin/spine-cli/verify.mjs`
- Change runtime behavior
