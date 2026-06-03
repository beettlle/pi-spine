# Task: SP-056 — Worker output capture on terminal failure (FR-STALL-01)

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 1 (redaction), Reversibility: 0

## Mission

When a lane worker dies with `stall_timeout`, `failed`, or `aborted`, operators often see **`task.failed` with empty `output`** (SearchATon SAT-020, pi-spine incident I-01). Implement **FR-STALL-01**: bounded stdout/stderr capture, persisted lane logs, journal `lane.stall_killed`, and evidence references — without weakening `.DONE` or merge policy.

**Success:** Stall repro yields non-empty truncated `output`, on-disk `worker-output-<taskId>.log`, diagnose cites log path.

## Dependencies

- **None**

## Context to Read First

**Tier 3:** `docs/features/stall-recovery-improvements-brief.md` (Feature 1), `docs/incidents/20260531-phase0-taskplane-batch.md`, `src/batch/worker-host.mjs`, `src/batch/agent-session-worker.mjs`, `src/batch/journal.mjs`

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/agent-session-worker.mjs`
- `src/batch/journal.mjs`
- `src/batch/heartbeat.mjs`
- evidence / gate collector modules
- `bin/spine-config.mjs`, `templates/spine-config.json`
- `tests/batch/stall-output.test.mjs` (new)

## Steps

### Step 1: Config + capture utilities

> **Plan-review checkpoint**

- [ ] Lane keys: `workerOutputMaxBytes`, `workerOutputTailLines`, `retainWorkerOutputOnSuccess`
- [ ] `captureWorkerOutputTail` with truncation marker
- [ ] `redactWorkerOutput` (built-in + config deny patterns)

### Step 2: Persist logs + wire stall kill

- [ ] Capture on terminal failure including stall `SIGTERM` path
- [ ] Write `.spine/runtime/<batchId>/lanes/lane-<N>/worker-output-<taskId>.log`
- [ ] Journal `lane.stall_killed` (exitCode, logPath, stallDeadline, signals)
- [ ] Agent-session stdout/stderr forwarding (or document gap)

### Step 3: Journal payload + evidence

> **Code review checkpoint**

- [ ] `task.failed.output` populated when bytes exist
- [ ] Evidence ref on gate; diagnose cites log path

### Step 4: Tests + verification

- [ ] `tests/batch/stall-output.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] FR-STALL-01.1–01.6; merge/.DONE policy unchanged

## Must Update

- `templates/spine-config.json`

## Do NOT

- SP-057/058/059 scope; weaken stall kill

## Environment

- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

`feat(SP-056): capture worker output on stall`

## Amendments

_(Workers only.)_
