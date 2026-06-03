# TP-018: Archive-first abort — Status

**Status:** Complete | **Last Updated:** 2026-06-01 | **Size:** M

## Steps

### Step 0: Preflight
- [x] §18.6; GAP-ABORT-01

### Step 1: Abort implementation
- [x] `abortBatch({ hard })`; archive-first; journal

### Step 2: CLI + tests
- [x] `spine batch abort [--hard]`; `/spine-abort`; tests

### Step 3: Docs
- [x] README; gap list; CONTEXT

## Completion Criteria

- [x] Abort never deletes state without archive; tests pass

## Notes

- `src/batch/abort.mjs` — archive-first abort, abort signal, hard kill + optional worktree cleanup
- Worker host polls abort signal; records `lane.workerPid` during spawn
- 98 tests pass (`npm test`)
