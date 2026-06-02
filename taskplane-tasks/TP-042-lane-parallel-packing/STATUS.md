# TP-042: Fix lane packing vs parallel execution — Status

**Status:** Done | **Last Updated:** 2026-06-02 | **Review Level:** 2 | **Size:** M

### Step 0 — Done | Step 1 — Done | Step 2 — Done | Step 3 — Done | Step 4 — Done

## Summary

Fixed scheduler/engine mismatch from batch `20260602T194520`: disjoint-scope tasks (TP-034/038/041) now get separate virtual lanes; overlapping scopes share a lane; engine serializes multiple tasks on one worktree; dashboard distinguishes active vs batch-assigned tasks.

## Baseline

- [x] `SPINE_WORKER_STUB=1 npm test` — 280 pass, 2 pre-existing worker-tools failures (`typebox` module)
- [ ] `npm run typecheck` — pre-existing `typebox` missing in extensions

## Verification

- [x] `node bin/spine.mjs plan TP-034 TP-038 TP-041` → 3 lanes in tick 0
- [x] Planner, engine, dashboard tests added and passing

## Commits

- `fix(TP-042): assign disjoint tasks to separate virtual lanes`
- `fix(TP-042): serialize tasks on the same physical lane`
- `feat(TP-042): dashboard separates active lane tasks from assignment`
- `docs(TP-042): wave vs lane vs tick and close GAP-SCHED-01`
