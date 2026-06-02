# Taskplane compatibility gap list

Tracked gaps discovered during pi-spine dogfooding. Each gap maps to pi-spine requirements in `pi-spine-PRD.md` §18.8.

**Last updated:** 2026-06-02  
**Source incident:** [`../incidents/20260531-phase0-taskplane-batch.md`](../incidents/20260531-phase0-taskplane-batch.md)

| ID | Taskplane behavior | pi-spine requirement | Status |
|----|---------------------|----------------------|--------|
| GAP-RETRY-01 | `orch_retry_task` resets task record but not segment frontier | §18.5 atomic retry | **Closed** — `spine batch retry` + `/spine-retry-task` (TP-017) |
| GAP-ABORT-01 | Abort deletes `.pi/batch-state.json` without guaranteed segment archive | §18.6 archive-first abort | **Closed** — `spine batch abort` + `/spine-abort` (TP-018) |
| GAP-STALL-01 | Stall kill on tool-call silence only | §18.4 progress-aware stall, FR-WORK-10 | **Closed (TP-029)** — STATUS mtime, lane commit, file-scope mtime in `collectProgressSignals`; tests in `heartbeat.test.mjs`, `incidents.test.mjs` |
| GAP-MERGE-01 | Force-resume can merge succeeded lanes while failed task pending | §17.4 mixed-outcome policy | **Closed (TP-019)** — wave merge blocked until all tasks terminal/skipped/force-merge |
| GAP-POST-01 | Supervisor summary claims batch "ran smoothly" with failures | NFR-OBS-03 | **Closed (TP-022)** — `generateBatchPostMortem` + evidence `summary.md` |
| GAP-REV-01 | Plan review fail-open when review tool errors at level > 0 | FR-REV-06 | **Closed (TP-020)** — `spine review step` + fail-closed worker |
| GAP-PREFLIGHT-01 | No batch preflight before `/orch all` | FR-BATCH-11, §23.1 | **Closed** — `spine preflight` + `/spine` gate with wave plan (TP-006 + TP-008) |
| GAP-UX-01 | All tasks succeeded, batch `stopped`, UI red | FR-BATCH-12–16, §17.5 | **Closed** — `spine status --diagnose` + `spine batch dismiss` / `complete` (TP-009 + TP-010) |
| GAP-UX-02 | "Pause?" when nothing running | FR-BATCH-18, §17.5 | **Closed** — reconciliation and `/spine` never suggest pause for limbo (TP-010) |
| GAP-UX-03 | Live status vs disk `phase` mismatch | NFR-OBS-04 | **Closed (TP-026)** — dashboard snapshot + CLI share `reconcileBatch()`; parity tests; `/spine-dashboard` |
| GAP-UX-04 | Manual git merge leaves active batch | FR-BATCH-16, §18.9 | **Closed** — `spine batch complete --detect-manual-merge` (TP-010) |
| GAP-BATCH-PENDING-01 | `/orch all` runs full backlog; no pending-only scope | FR-SCHED-06, §15.2 `spine run <scope>` | **Closed (TP-024)** — `pending` scope, relaxed batch `all`, `spine run pending` |
| GAP-PROGRESS-01 | No structured worker progress journal signal for stall grace | PRD §14.5 `spine_report_progress`, §18.4 | **Closed (TP-036)** — `spine report progress` + `task.step_completed`; heartbeat honors journal progress |
| GAP-WORKER-TOOLS-01 | Worker MCP tools not registered in pi runtime | PRD §14.5 | **Closed (TP-038)** — `spine_review_step`, `spine_report_progress`, `spine_request_gate` via `registerSpineWorkerTools`; gate tool returns `not_supported` for integrate-only v1.1 |
| GAP-RESUME-MULTI-01 | Paused multi-task batch could not resume (single-lane gate; batch `20260602T181027`) | §18.2 multi-task resume, FR-BATCH-14 | **Closed (TP-039–041)** — `spine batch resume` for multi-task batches; `spine status --diagnose` multi-task paused headline; `tests/batch/resume-multi-integration.test.mjs` |

## Verification

| Phase | Evidence |
|-------|----------|
| Phase 6 (TP-029) | [`phase6-dogfood-report.md`](phase6-dogfood-report.md), [`tests/compat/incidents.test.mjs`](../../tests/compat/incidents.test.mjs), [`tests/batch/integration-abc.test.mjs`](../../tests/batch/integration-abc.test.mjs) |
| Phase 8 multi-task resume (TP-041) | [`tests/batch/resume-multi-integration.test.mjs`](../../tests/batch/resume-multi-integration.test.mjs), [`tests/batch/resume-multi-engine.test.mjs`](../../tests/batch/resume-multi-engine.test.mjs) |

Regression tests assert pi-spine behavior for each incident **I-01–I-10**; optional Taskplane baseline comparison is not required for CI.
