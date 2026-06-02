# TP-036: spine_report_progress core + CLI — Status

**Status:** Complete | **Last Updated:** 2026-06-02 | **Review Level:** 2 | **Size:** S

### Step 0 — Done | Step 1 — Done | Step 2 — Done | Step 3 — Done

## Summary

Implemented `reportTaskProgress` (`task.step_completed` journal events), `spine report progress` CLI (env: `SPINE_BATCH_ID`, `SPINE_TASK_ID`, `SPINE_LANE_NUMBER`/`SPINE_LANE_ID`), and heartbeat stall wiring via `stepCompletedAtMs` in `collectProgressSignals`.

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (220 pass; 1 pre-existing flaky `cli-startup` timeout unrelated)

## Commits

- `c060f9a` feat(TP-036): spine report progress core and CLI
- `347ad55` feat(TP-036): heartbeat honors task.step_completed progress
