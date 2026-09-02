# Task: SP-737 — Stall watchdog treats static-null progress as non-progress

**Created:** 2026-08-30
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Stall classification on heartbeat signals; wrong progress reset wedges batches for hours.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Closes #272 — When `lane.heartbeat` reports `worker_alive` with static-null progress signals (`statusMtimeMs`, `lastCommitAtMs`, `fileScopeMtimeMs`, `dirtyPathCount` all null/zero and unchanged), do not reset the stall anchor. Past the task stall budget, journal `lane.stall_warning` / `lane.stall_killed` (or equivalent) instead of infinite healthy heartbeats. Child process liveness alone must not count as progress.

## Dependencies

- **None**

## Context to Read First

- GitHub #272 — repro: SIGSTOP worker pi; observe static-null heartbeats past S budget
- `src/batch/heartbeat.mjs` — `checkpointSignalsChanged` / stall config
- `src/batch/worker-heartbeat.mjs` — `pollWorkerUntilSettled`
- `tests/batch/heartbeat.test.mjs`, `tests/batch/heartbeat-subprocess.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/heartbeat.mjs`
- `src/batch/worker-heartbeat.mjs`
- `tests/batch/heartbeat.test.mjs`
- `tests/batch/heartbeat-subprocess.test.mjs`
- `tests/batch/stall-sat020-integration.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/heartbeat.test.mjs tests/batch/heartbeat-subprocess.test.mjs tests/batch/stall-sat020-integration.test.mjs tests/batch/task-stall-budget.test.mjs` |
| fileScopeMustChange | `src/batch/heartbeat.mjs`, `src/batch/worker-heartbeat.mjs`, `tests/batch/heartbeat.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read `checkpointSignalsChanged` / heartbeat progress snapshot construction
- [ ] Confirm existing stall tests and SAT-020 coverage gaps for static-null

### Step 1: Treat static-null as non-progress

- [ ] Progress signal change must require a real signal delta (mtime/commit/dirty), not heartbeat emission or child liveness alone
- [ ] Static-null snapshots across heartbeats must not refresh the stall anchor
- [ ] Past budget: emit stall warning/kill journal events (match existing stall event types)

### Step 2: Regression tests

- [ ] Unit/integration: simulated static-null heartbeats past budget → stall classification
- [ ] Child-alive-but-idle must not defeat stall (document SIGSTOP-style proxy in test comments)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] None required beyond test comments
- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**

- None required beyond test comments

## Completion Criteria

- [ ] Static-null progress no longer resets stall budget
- [ ] Stall events journaled when budget exceeded
- [ ] Scoped stall/heartbeat tests pass
- [ ] Closes #272
- [ ] `.DONE` created

## Do NOT

- Change salvage/gate reopen paths (#274/#275)
- Change timeout-vs-.DONE classification (#273) beyond shared stall helpers if unavoidable — prefer SP-738 for exit classification
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `fix(SP-737): stall on static-null heartbeat progress (#272)`
