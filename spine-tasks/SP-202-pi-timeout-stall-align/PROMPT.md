# Task: SP-202 — Align pi worker timeout with stall budget

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Root-cause fix for SP-195/SP-199 batch `20260612T023712` — pi killed at 60m while M-task stall budget is 180m.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Close the **pi timeout vs stall budget mismatch** that caused real-pi workers to exit 124 (`pi worker timed out`) around 66 minutes while `resolveTaskStallMinutes` allows 180m for M tasks.

**Incident:** Batch `20260612T023712` — SP-195 and SP-199 failed twice with salvageable uncommitted work; `spine-worker-runner.mjs` hard-caps `spawnSync("pi")` at 60m via `SPINE_WORKER_PI_TIMEOUT_MS` default, but `worker-host.mjs` never passes stall-derived timeout to the child env.

**Required behavior:**
1. `buildWorkerChildEnv` sets `SPINE_WORKER_PI_TIMEOUT_MS` from per-task stall budget (`resolveStallConfigForTask`) unless explicitly overridden in parent env.
2. `runWorker` computes timeout from task Size + `lanes.stallTimeoutMinutes` (same source as stall detection).
3. `spine doctor` warns when implicit pi cap (60m) would be below effective stall minutes for configured real-pi runs.
4. Regression tests assert M-task timeout ≥ 180m and env is passed to runner child.

## Dependencies

- **Task:** SP-088

## Context to Read First

**Tier 3:**
- `bin/spine-worker-runner.mjs` — `SPINE_WORKER_PI_TIMEOUT_MS`
- `src/batch/worker-host.mjs` — `buildWorkerChildEnv`, `runWorker`
- `src/batch/task-stall-budget.mjs` — `STALL_MINUTES_BY_SIZE`
- `src/doctor/stall-config.mjs`
- Batch `20260612T023712` worker logs (exit 124 ~66m)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/task-stall-budget.mjs`
- `src/doctor/stall-config.mjs`
- `tests/batch/worker-pi-timeout.test.mjs` (new)
- `docs/adoption/operator-runbook.md` (timeout env note)
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/worker-host.mjs`, `src/batch/task-stall-budget.mjs`, `src/doctor/stall-config.mjs`, `tests/batch/worker-pi-timeout.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Trace timeout path: `runWorker` → `spawnWorkerChild` → `spine-worker-runner` → `spawnSync(pi)`
- [ ] Confirm M-task stall minutes (180) vs runner default (60)

### Step 1: Wire stall budget to pi timeout

> **Plan-review checkpoint**

- [ ] Export `resolveWorkerPiTimeoutMs` from task-stall-budget (or worker-host)
- [ ] Set `SPINE_WORKER_PI_TIMEOUT_MS` in `buildWorkerChildEnv` from computed value
- [ ] Respect explicit parent env override when set

### Step 2: Doctor + tests

> **Code review checkpoint**

- [ ] Doctor warning for pi-cap < stall budget
- [ ] Unit tests for M/S/L size floors and env propagation
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Update findings.md — incident closed
- [ ] Create `.DONE`

## Completion Criteria

- [ ] M-size real-pi workers receive ≥180m pi timeout by default
- [ ] No more 60m silent cap contradicting stall budget docs

## Git Commit Convention

- `feat(SP-202): complete Step N — description`

## Do NOT

- Remove `SPINE_WORKER_PI_TIMEOUT_MS` env override for operators
- Change stall detection semantics (only align pi subprocess cap)
