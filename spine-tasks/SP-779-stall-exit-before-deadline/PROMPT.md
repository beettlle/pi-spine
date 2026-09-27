# Task: SP-779 — Stall watchdog observes worker exit before deadline

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Changes the worker poll loop that classifies every lane outcome; a wrong ordering can hide real stalls or misclassify exits.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** `pollWorkerUntilSettled` evaluates the stall deadline before checking `workerChild.exitCode`. A worker that exits on its own between polls (~5 s apart) is classified `stall_timeout` once the next poll is past the budget. This flakes `tests/batch/contract-stall-override.test.mjs` under full-suite load and reds `npm test` / `release:check`.

## Mission

Closes #308 — A worker that has already exited is never classified `stall_timeout`, and the stall-override tests become deterministic.

1. In `src/batch/worker-heartbeat.mjs` `pollWorkerUntilSettled`, observe child exit **before** evaluating the stall deadline. Preferred: race the inter-poll sleep against the child-exit promise (`await Promise.race([sleep(interval), childDone])`) and check `workerChild.exitCode !== null` before the deadline branch. The SP-738 `.DONE`-at-stall branch keeps working.
2. Add injectable timing to `pollWorkerUntilSettled`: an optional `deps = { now = Date.now, sleep = defaultSleep }` parameter. Production callers pass nothing; `stallConfig.pollIntervalMs` stays the poll-interval source.
3. Rewrite the two scaled tests in `tests/batch/contract-stall-override.test.mjs` to call `pollWorkerUntilSettled` directly, with a fake child (an `EventEmitter` exposing `exitCode`) and a virtual clock:
   - no stall at virtual 10 s with a 12 s contract budget;
   - stall at virtual 5 s with a 2.4 s global budget.
   Keep **one** real-subprocess test with generous margins that asserts classification only. Remove the coverage-mode skip.
4. Add an ordering regression test in `tests/batch/heartbeat.test.mjs`: the child exits, the deadline passes, and the next poll yields exit classification, not `stall_timeout`.

## Dependencies

- **None**

## Context to Read First

- `src/batch/worker-heartbeat.mjs` — `pollWorkerUntilSettled` (deadline check ~line 356, exit check ~line 399)
- `src/batch/worker-host.mjs` — the only production caller (~line 275); do not change its call shape
- `tests/batch/contract-stall-override.test.mjs` — current scaled tests (lines 98–180) and coverage skip (lines 20–22, 100)
- GitHub #308 (regression of #24; context #272, #273 / SP-738)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`) — worker-session env trips the SP-482 nested-spawn guard inside test subprocesses

## File Scope

- `src/batch/worker-heartbeat.mjs`
- `tests/batch/contract-stall-override.test.mjs`
- `tests/batch/heartbeat.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-stall-override.test.mjs tests/batch/heartbeat.test.mjs` |
| fileScopeMustChange | `src/batch/worker-heartbeat.mjs`, `tests/batch/contract-stall-override.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read the poll loop; confirm deadline-before-exit ordering at HEAD
- [ ] `rg -n "pollWorkerUntilSettled" src tests` — list every caller and test
- [ ] Dependencies satisfied

### Step 1: Exit-before-deadline ordering + injectable timing

- [ ] Child exit is observed before the stall deadline branch (sleep raced against `childDone`)
- [ ] Optional `deps = { now, sleep }` parameter; defaults preserve production behavior
- [ ] `.DONE`-at-stall (SP-738) and static-null heartbeat (#272) behavior unchanged
- [ ] `src/batch/worker-heartbeat.mjs` stays ≤ 500 lines (batch LOC policy)

**Artifacts:**
- `src/batch/worker-heartbeat.mjs` (modified)

### Step 2: Deterministic tests

- [ ] Virtual-clock tests replace the two scaled wall-clock tests
- [ ] One real-subprocess test remains with generous margins (classification only)
- [ ] Coverage-mode skip removed
- [ ] Ordering regression test in `tests/batch/heartbeat.test.mjs`
- [ ] Loop the stall file 20× locally: `for i in $(seq 20); do node --experimental-strip-types --test tests/batch/contract-stall-override.test.mjs || break; done` — record the result in STATUS.md

**Artifacts:**
- `tests/batch/contract-stall-override.test.mjs` (modified)
- `tests/batch/heartbeat.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md (loop results, any timing assumptions)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — stall classification notes (SP-789 owns runbook edits this release)

## Completion Criteria

- [ ] A worker that exits before the next poll is never classified `stall_timeout`
- [ ] Stall-override tests are wall-clock independent and run under coverage
- [ ] Contract green
- [ ] Closes #308

## Git Commit Convention

- `fix(SP-779): observe worker exit before stall deadline (#308)`

## Do NOT

- Change default stall budgets or `POLL_INTERVAL_MS`
- Change `worker-host.mjs` or the `pollWorkerUntilSettled` return shape
- Widen test margins as the fix (that was #24; it regressed)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
