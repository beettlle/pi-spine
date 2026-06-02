# TP-040: Multi-task resume engine + detached — Status

**Status:** Complete | **Last Updated:** 2026-06-02 | **Review Level:** 2 | **Size:** M

### Step 0 — Done | Step 1 — Done | Step 2 — Done | Step 3 — Done

## Summary

Implemented `resumeMultiTaskBatch` in `src/batch/resume-multi.mjs`: validates via TP-039, sets phase `running` with `batch.resumed` journal, runs pending tasks in parallel per wave/lane (stub workers), merges lane branches, completes batch. `resumeBatch` routes to multi path when `tasks.length > 1 || lanes.length > 1`. Detached resume (`spine batch resume`) unchanged — already spawns attached engine via `resumeBatchDetached`. Added `tests/batch/resume-multi-engine.test.mjs`; updated README multi-task resume docs.

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 260/261 pass (+2 new; 1 pre-existing `review-step-tool` flake)

## Reviews

- [x] Step 1 plan review — APPROVE
- [x] Step 3 code review — APPROVE

## Commits

- `0d7bd30` — feat(TP-033): batch worker completion (includes TP-040 engine + tests + README)

## Completion Criteria

- [x] Multi-task resume executes in stub mode tests
- [x] Detached resume path invoked (existing `resumeBatchDetached` + engine routing)
- [x] No `single_lane_required` for valid multi batches
