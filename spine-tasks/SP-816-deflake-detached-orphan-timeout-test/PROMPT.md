# Task: SP-816 — Deflake detached-start orphan-timeout test

**Created:** 2026-10-03
**Size:** S

## Review Level: 0 (None)

**Risk:** Test-only change.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `tests/batch/detached-start-orphan-timeout.test.mjs` test 2 ("startBatchDetached persists spawn enginePid before wait on timeout failure path", lines 70-132) spawns a fake engine (`setTimeout(() => process.exit(0), 50)`). About 30 s later it asserts `isProcessAlive(enginePid) === false` (line 124) and that `reconcileBatch` reports `engine_orphaned` (126-128). `isProcessAlive` is `process.kill(pid, 0)` and returns true on `EPERM`. After 30 s of full-suite churn a recycled PID reads as alive, so the run fails about 1 time in 10.

## Mission

Closes #333 — The test proves the spawned engine exited without relying on PID liveness after a 30 s wait.

1. The fake engine writes an exit-marker file (path under `projectRoot`, passed through its source) right before `process.exit(0)`.
2. Replace the line-124 assertion with an assertion that the marker exists (keep the line-123 "pid persisted" assertion).
3. Before the `reconcileBatch` call, load the state, overwrite `resilience.enginePid` with `DEAD_PID` through `recordBatchEnginePid(state, DEAD_PID)`, and save with `saveSpineBatchState`. The engine_orphaned assertion then no longer depends on PID reuse. Test 1's pattern already does this.
4. Run the file 5 times in a row; all must pass.

## Dependencies

- **None**

## Context to Read First

- GitHub #333
- `tests/batch/detached-start-orphan-timeout.test.mjs` (132 lines)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `tests/batch/detached-start-orphan-timeout.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/detached-start-orphan-timeout.test.mjs` |
| fileScopeMustChange | `tests/batch/detached-start-orphan-timeout.test.mjs` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Dependencies satisfied

### Step 1: Exit marker + dead PID

- [ ] Marker written and asserted
- [ ] Stored pid overwritten with `DEAD_PID` before reconcile

**Artifacts:**
- `tests/batch/detached-start-orphan-timeout.test.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` 5 times in a row — all pass
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] No PID-liveness assertion after the 30 s wait
- [ ] Closes #333

## Git Commit Convention

- `test(SP-816): assert fake engine exit via marker, not PID liveness (#333)`

## Do NOT

- Change `src/process/liveness.mjs` or `src/batch/detached-start.mjs`
- Lower the detached wait timeout
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
