# Incident Report: Batch retry state drift `20260605T191325`

**Date:** 2026-06-05  
**Orchestrator:** pi-spine multi-lane batch (Phase 21 remediation wave)  
**Repo:** pi-spine (dogfood)  
**Outcome:** SP-118 completed on retry (journal `task.completed`) but batch-state kept `status=failed` with stale `prompt_parse_failed` classification until a third retry; wave merge blocked  
**Fix task:** SP-120

---

## Executive summary

During batch `20260605T191325` stress testing, task **SP-118** failed once with `prompt_parse_failed`, was retried, and the worker emitted `task.completed`. The journal reflected success, but **batch-state** still showed the task as failed with stale failure metadata. `spine status --diagnose` continued to surface retry guidance tied to the prior classification, and `assessWaveMergeEligibility` blocked the wave merge because the task row remained terminal-failure.

SP-120 centralizes retry reset and success transitions in `state.mjs` so retry clears `exitReason`/`classification` on task and segment rows, and successful completion recomputes counters through `recordTaskSucceeded`.

---

## Timeline

| Time (approx) | Event |
|---------------|-------|
| T+0 | Batch `20260605T191325` starts Phase 21 remediation wave |
| T+fail | `task.failed` SP-118 — `classification: prompt_parse_failed` |
| T+retry1 | `task.retry_requested` — operator fixes PROMPT scope |
| T+resume | Worker completes; journal `task.completed` for SP-118 |
| T+drift | Batch-state task row still `status=failed`, `exitReason=prompt_parse_failed` |
| T+operator | `spine status --diagnose` → `needs_retry` / stale exit reason |
| T+retry2 | Second retry + resume — same drift pattern |
| T+retry3 | Third retry cycle finally aligned state (manual observation during stress test) |
| T+fix | SP-120 — atomic reset + `recordTaskSucceeded` + regression tests |

---

## Root cause

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Journal shows `task.completed` but batch-state `tasks[].status=failed` | Retry/success paths updated counters and segments inconsistently; stale `exitReason`/`classification` survived reset | **SP-120** — `resetTaskForRetry`, `clearTaskFailureMetadata`, `recordTaskSucceeded`, shared `recomputeTaskCounters` |
| Reconcile still cites `prompt_parse_failed` after success | Diagnosis reads stale `exitReason` from batch-state task row | Cleared on retry reset; success path overwrites with `done` |
| Wave merge blocked | `assessWaveMergeEligibility` sees `task.status === "failed"` | Success path sets `succeeded` + segment + counters atomically |

---

## Journal tail (retry drift pattern)

```
task.failed              SP-118   classification prompt_parse_failed
task.retry_requested     SP-118   previousClassification failed
task.completed           SP-118   (worker succeeded on retry)
```

Replay fixture: [`tests/fixtures/incidents/retry-clears-failed-classification.json`](../../tests/fixtures/incidents/retry-clears-failed-classification.json)

Automated regression: `tests/batch/retry-state-drift.test.mjs`

---

## Recovery procedure

1. `spine batch retry <taskId>` — resets task + segment rows and clears failure metadata.
2. `spine batch resume --force` — re-runs pending segments in existing lane worktrees.
3. `spine status --diagnose` — after SP-120, succeeded tasks must not diagnose as `needs_retry` with stale `prompt_parse_failed`.
4. Do not hand-edit `.spine/batch-state.json` to clear drift; use atomic retry.

---

## Related tasks

- **SP-118** — adoption docs task that surfaced the drift during batch `20260605T191325`
- **SP-120** — fix and regression coverage (this incident)
