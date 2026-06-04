# Incident Report: Resume parallel-lane orphan batch `20260603T224829`

**Date:** 2026-06-04  
**Orchestrator:** pi-spine forced multi-task resume (searchATon Wave 8)  
**Repo:** searchATon (consumer)  
**Outcome:** Batch stuck `phase: running` with dead `resilience.enginePid`, five concurrent `running` tasks on lane 1, and `spine status --diagnose` returning plain **`running`**  
**Fix tasks:** SP-095 (scoped orphan detect), SP-096 (per-lane resume serialization), SP-097 (engine crash surfacing), SP-098 (this fixture + doc)

This document captures the searchATon consumer incident that exposed four gaps after a forced resume of eight failed tasks. It complements SP-085 (`20260603T185308`) and the SP-095 unit fixture (`resume-orphan-historical-failure.json`) with the full multi-lane, parallel lane-1 replay snapshot.

---

## Executive summary

searchATon batch `20260603T224829` failed its first wave (devcontainer launch errors), was retried, and resumed with `resume --force` for eight pending segments across three lanes. The resume engine used **`Promise.all` over every pending task**, starting **five lane-1 tasks in parallel** on a single worktree. The engine then died during **`commitLaneWorktree`** (git worktree error) without writing a post-resume terminal journal event. Batch-state remained `phase: running` with a dead `enginePid` and multiple ghost `running` tasks on lane 1.

Before SP-095/097, reconcile scanned the **full** journal, matched **historical** `task.failed` / `batch.failed` from before the latest `batch.resumed`, and returned misleading **`running`**.

---

## Timeline

| Time (approx) | Event |
|---------------|-------|
| T+0 | Initial wave: all eight tasks fail (worker launch: `PI_SPINE_ROOT` / devcontainer) |
| T+1m | `batch.failed`; operator retries all tasks |
| T+2m | First `batch.resumed` (`resumeForced`) — parallel `task.started` across lanes; lane 1 starts SAT-036–SAT-044 concurrently |
| T+3m | Second `batch.resumed` after operator intervention — same parallel lane-1 pattern (SAT-036, SAT-039, SAT-040, SAT-042, SAT-043, SAT-044 within ~6s) |
| T+3m+ | Workers emit `lane.heartbeat`; engine dies in `commitLaneWorktree` (worktree/git failure) |
| T+silence | No post-resume `batch.failed`, `task.failed`, or `lane.died` |
| T+operator | `spine status --diagnose` → **`running`** (incorrect) |
| T+fix | SP-095 scoped orphan detect → `engine_orphaned`; SP-097 fail-closed crash handler → `phase: failed` + `batch.failed` |

---

## Root causes (four bugs)

| # | Symptom | Root cause | Fix task |
|---|---------|------------|----------|
| 1 | Dead engine + post-resume silence still **`running`** | `journalHasTerminalBatchEvent` matched **pre-resume** terminal events | **SP-095** — `journalEventsSinceResume` scopes to current engine session |
| 2 | Five lane-1 tasks **`running`** on one worktree | `resumeMultiTaskBatch` used flat `Promise.all` instead of per-lane serialization | **SP-096** — mirror `engine.mjs` lane grouping |
| 3 | Engine crash left **`phase: running`** | Uncaught error in `commitLaneWorktree` / resume wave with no `batch.failed` | **SP-097** — `failBatchFromEngineError`, ghost task cleanup |
| 4 | Operator blocked on false **`running`** | SP-082 orphan detect not applied when historical terminals suppressed engine signal | **SP-082** + **SP-095** reconcile path |

---

## Journal tail (post-resume silence pattern)

```
task.failed       SAT-040 lane-1          (historical — before resume)
batch.failed      prior wave
batch.resumed     resumeForced, 8 pending
task.started      SAT-036 lane-1          (resumed)
task.started      SAT-037 lane-2
task.started      SAT-038 lane-3
task.started      SAT-039 lane-1          ┐
task.started      SAT-040 lane-1          │ parallel lane-1
task.started      SAT-042 lane-1          │ starts (~6s)
task.started      SAT-043 lane-1          │
task.started      SAT-044 lane-1          ┘
lane.heartbeat    SAT-039, SAT-040
(silence — no terminal event after batch.resumed)
```

Replay fixture: [`tests/fixtures/incidents/resume-parallel-lane-orphan.json`](../../tests/fixtures/incidents/resume-parallel-lane-orphan.json)

Scoped orphan unit fixture (Bug 1 only): [`tests/fixtures/incidents/resume-orphan-historical-failure.json`](../../tests/fixtures/incidents/resume-orphan-historical-failure.json)

---

## Batch-state snapshot (symptoms)

| Field | Value | Problem |
|-------|-------|---------|
| `phase` | `running` | Stale — engine dead |
| `tasks` (lane 1) | SAT-039, SAT-040, SAT-042, SAT-043, SAT-044 **`running`** | Five concurrent running on one lane |
| `resilience.enginePid` | dead PID | Engine not alive |
| `resilience.engineStartedAt` | matches latest `batch.resumed` | Current session boundary for SP-095 |
| Journal (scoped) | No terminal after `batch.resumed` | Orphan signal |

PIDs in the replay fixture use sentinel **`999999999`** (never a live process).

---

## Reproduction sketch

1. Start or resume a multi-lane batch with **multiple tasks on lane 1** and prior failures in the journal.
2. Force resume (`spine batch resume --force`) with pre-fix `resume-multi.mjs` (flat `Promise.all`).
3. Confirm parallel `task.started` on lane 1 and multiple `running` tasks in batch-state.
4. Kill the detached engine or trigger `commitLaneWorktree` failure before any post-resume terminal event.
5. **Before SP-095:** `spine status --diagnose` → `running` (historical terminals suppress orphan detect).
6. **After SP-095:** `engine_orphaned` with `spine batch retry <taskId>`.
7. **After SP-097:** crash path writes `batch.failed` and `phase: failed` (fail-closed).

Automated regression: `tests/batch/orphan-reconcile.test.mjs` — `resume parallel lane orphan fixture`.

---

## Recovery procedure

1. `spine status --diagnose` — expect `engine_orphaned` or `needs_retry`, not `running`.
2. `spine journal tail` — confirm latest `batch.resumed`, parallel lane-1 starts, then silence.
3. `spine batch retry <taskId>` when headline names a running task (first running task in reconcile output).
4. `spine batch abort` when work should be discarded; fix lane worktree/git issues before re-resume.
5. Never hand-edit `.spine/batch-state.json`.

See [operator runbook § Orphan running](../adoption/operator-runbook.md#orphan-running-zombie-batch) and [§ Resume engine crash](../adoption/operator-runbook.md#resume-engine-crash-fail-closed).

---

## Traceability

| Requirement | Location |
|-------------|----------|
| FR-BATCH-12 orphan detection | `src/batch/orphan-detect.mjs`, `src/batch/reconcile.mjs` |
| FR-BATCH-13 `engine_orphaned` | `docs/PRD.md` §18.3 |
| SP-095 resume-scope fix | `tests/batch/orphan-detect-scope.test.mjs` |
| SP-096 lane serialization | `tests/batch/resume-multi-sequential.test.mjs` |
| SP-097 crash surfacing | `tests/batch/resume-engine-crash.test.mjs` |
| SP-098 fixture + doc | This file + `resume-parallel-lane-orphan.json` |
| Prior incident (single-task resume) | [`20260603-orphan-running-resume.md`](20260603-orphan-running-resume.md) |

---

## Document history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-06-04 | Initial report + replay fixture (SP-098) |
