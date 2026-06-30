# Task: SP-365 — Live lane worker log

**Created:** 2026-06-29
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Streams worker output during run across subprocess and agentSession backends; security redaction required.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Fix **GitHub issue #49**: append live worker output to `.spine/runtime/<batchId>/lanes/lane-N/worker-live-<taskId>.log` during the run (not only on terminal failure).

**Required behavior:**

1. Stream subprocess stdout/stderr chunks from `worker-host.mjs`
2. Flush agentSession transcript chunks from `agent-session-worker.mjs`
3. Redaction via `redactWorkerOutput`; size cap + truncation marker
4. Config: `lanes.streamWorkerOutputLive` (default false), `lanes.workerLiveLogMaxBytes`
5. Terminal failure `worker-output-<taskId>.log` behavior unchanged

**Closes:** [#49](https://github.com/beettlle/pi-spine/issues/49)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #49
- `src/batch/worker-output.mjs`, `src/batch/worker-host.mjs`, `src/batch/agent-session-worker.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/worker-output.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/agent-session-worker.mjs`
- `templates/spine-config.json`
- `tests/batch/live-worker-log.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/live-worker-log.test.mjs` |
| fileScopeMustChange | `src/batch/worker-output.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/live-worker-log.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Audit FR-STALL-01 terminal capture paths

### Step 1: Live log writer

- [ ] Add live log path helper and append-with-cap in `worker-output.mjs`
- [ ] Config resolution for stream toggle and max bytes

### Step 2: Wire subprocess and agentSession backends

- [ ] Stream chunks in `worker-host.mjs` collectChildOutput path
- [ ] Periodic flush in `agent-session-worker.mjs`

### Step 3: Tests

- [ ] Add `tests/batch/live-worker-log.test.mjs` (stub + agentSession stub paths)

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #49 (`gh issue close 49`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #49 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-365): complete Step N — description`

## Do NOT

- Break terminal failure log capture
- Log secrets without redaction
