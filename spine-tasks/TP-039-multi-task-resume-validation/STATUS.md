# TP-039: Multi-task resume validation — Status

**Status:** Done | **Last Updated:** 2026-06-02 | **Review Level:** 2 | **Size:** S

### Step 0 — Done | Step 1 — Done | Step 2 — Done

## Summary

Removed the TP-015 single-task/single-lane resume gate at the validation layer. Added `validateMultiTaskResume` in `src/batch/resume-multi.mjs` with per-lane worktree checks, pending task detection, and resumable wave computation. `validateResumeBatch` now delegates to the multi validator (single-task is a subset).

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 230/230 pass

## Commits

- `feat(TP-039): add multi-task resume validation`
- `feat(TP-039): add multi-task resume validation tests`
