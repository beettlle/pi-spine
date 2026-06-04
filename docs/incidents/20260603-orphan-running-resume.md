# Incident Report: Orphan Running Batch `20260603T185308`

**Date:** 2026-06-03  
**Orchestrator:** pi-spine detached resume (searchATon Wave 8)  
**Repo:** searchATon (consumer)  
**Outcome:** Batch stuck `phase: running` with dead worker/engine PIDs; operator could not tell batch was zombie  
**Fix tasks:** SP-082 (reconciliation), SP-085 (this fixture + doc)

This document captures the searchATon consumer bug that motivated orphan-running detection in pi-spine. It complements SP-082 unit tests with a documented incident narrative and replay fixture.

---

## Executive summary

searchATon Wave 8 batch `20260603T185308` resumed after a prior failure. The detached batch engine spawned a lane worker, recorded `task.started` and one `lane.heartbeat`, then **both processes died without a terminal journal event**. Batch-state remained `phase: running` with stale `workerPid` and `resilience.enginePid`. Before SP-082, `spine status --diagnose` returned plain **`running`**, blocking operator recovery.

Worker infra failures (OOM, kill -9, host crash) are expected in long batches. The spine gap was **misleading reconciliation** — not detecting dead PIDs when journal had no terminal event.

---

## Timeline

| Time (approx) | Event |
|---------------|-------|
| T+0 | Detached resume: `batch.resumed` with `pendingSegments=1` |
| T+1s | `task.started` for SAT-040 (lane 1) |
| T+52s | Last `lane.heartbeat` for SAT-040 |
| T+? | Worker and/or engine process exit (no `task.failed`, `lane.died`, or `batch.failed`) |
| T+operator | `spine status --diagnose` → **`running`** (incorrect) |
| T+fix | SP-082: reconcile detects dead `workerPid` → `needs_retry` with `spine batch retry SAT-040` |

---

## Journal tail (last events before silence)

```
batch.resumed   pendingSegments=1
task.started    SAT-040 lane-1
lane.heartbeat  SAT-040 lane-1
(silence — no terminal event)
```

Replay fixture: [`tests/fixtures/incidents/orphan-running-resume.json`](../../tests/fixtures/incidents/orphan-running-resume.json)

---

## Batch-state snapshot (symptoms)

| Field | Value | Problem |
|-------|-------|---------|
| `phase` | `running` | Stale — no live engine |
| `tasks[0].status` | `running` | Task never terminal |
| `lanes[0].workerPid` | dead PID | Process not alive |
| `resilience.enginePid` | dead PID | Engine not alive |
| Journal | No terminal event | Orphan signal not written |

---

## Reproduction sketch

1. Start a batch with detached engine (`spine batch start` or resume after failure).
2. Confirm `phase: running`, task `running`, PIDs recorded in batch-state.
3. Kill engine and/or lane worker (`kill -9`) after `task.started` + `lane.heartbeat` but before any terminal journal event.
4. **Before SP-082:** `spine status --diagnose` → `running`.
5. **After SP-082:** `needs_retry` (dead worker) or `engine_orphaned` (dead engine only) with actionable `suggestedCommand`.

Automated regression: `tests/batch/orphan-reconcile.test.mjs` — `searchATon orphan incident fixture`.

---

## Acceptance criteria checklist

- [x] JSON fixture: batch-state + journal tail matching bug report (`orphan-running-resume.json`)
- [x] Test asserts reconcile diagnosis ≠ `running`
- [x] Diagnosis is actionable (`needs_retry` / `engine_orphaned` + `spine batch retry <id>`)
- [x] Incident narrative documented (this file)
- [x] Operator runbook cross-reference ([§ Orphan running](../adoption/operator-runbook.md#orphan-running-zombie-batch))

---

## Recovery procedure

1. `spine status --diagnose` — expect `needs_retry` or `engine_orphaned`, not `running`.
2. `spine journal tail` — confirm `task.started` / `lane.heartbeat` then silence.
3. `spine batch retry <taskId>` when headline names a running task.
4. `spine batch abort` when work should be discarded.
5. Never hand-edit `.spine/batch-state.json`.

See [operator runbook § Orphan running](../adoption/operator-runbook.md#orphan-running-zombie-batch).

---

## Traceability

| Requirement | Location |
|-------------|----------|
| FR-BATCH-12 orphan detection | `src/batch/orphan-detect.mjs`, `src/batch/reconcile.mjs` |
| FR-BATCH-13 `engine_orphaned` | `docs/PRD.md` §18.3 |
| SP-082 implementation | `tests/batch/orphan-reconcile.test.mjs` (unit tests) |
| SP-085 fixture + doc | This file + `tests/fixtures/incidents/` |

---

## Document history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-03 | Initial report + replay fixture (SP-085) |
