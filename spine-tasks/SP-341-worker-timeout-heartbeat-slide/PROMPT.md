# Task: SP-341 — Worker timeout heartbeat slide

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Pi worker hard timeout does not extend on `worker_alive` heartbeats — M-tasks killed at wall clock despite active work.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #32**: worker stall timeout should slide on `worker_alive` heartbeats so long-running but active tasks are not killed at fixed wall clock.

**Required behavior:**

1. Reset stall deadline on each `worker_alive` heartbeat when task is `running`.
2. Configurable `stallTimeoutMinutes` still applies to silent stalls (no heartbeat).
3. Regression test: heartbeat extends timeout; silent stall still fails.

**Closes:** [#32](https://github.com/beettlle/pi-spine/issues/32)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #32
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/heartbeat.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/engine-lanes/watch.mjs`
- `tests/batch/worker-timeout-heartbeat-slide.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/worker-timeout-heartbeat-slide.test.mjs` |
| fileScopeMustChange | `src/batch/heartbeat.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/worker-timeout-heartbeat-slide.test.mjs` |

## Steps

### Step 0: Preflight: trace stall timeout vs heartbeat

- [ ] Preflight: trace stall timeout vs heartbeat

### Step 1: Slide timeout on worker_alive

- [ ] Slide timeout on worker_alive

### Step 2: Tests + delivery

- [ ] Tests + delivery

### Step 3: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Close issue #32 (`gh issue close 32`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #32 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-341): complete Step N — description`
- `fix(SP-341): description`
- `test(SP-341): description`

## Do NOT

- Expand scope beyond issue #32 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
