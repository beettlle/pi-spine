# TP-042: Fix lane packing vs parallel execution — Status

**Status:** In Progress | **Last Updated:** 2026-06-02 | **Review Level:** 2 | **Size:** M

### Step 0 — Done | Step 1 — In Progress | Step 2 — Not Started | Step 3 — Not Started | Step 4 — Not Started

## Summary

Step 0: reproduced bug (all three tasks on Lane 0); tests baseline 272 pass (2 pre-existing worker-tools failures); typecheck fails on missing `typebox` in extensions (pre-existing).

Step 1: inverted greedy overlap rule in `lanes.mjs` — overlapping scopes share a lane, disjoint scopes get new lanes. Regression fixture shows 3 lanes.

## Baseline

- [x] `SPINE_WORKER_STUB=1 npm test` — 272 pass, 2 pre-existing worker-tools failures
- [ ] `npm run typecheck` — pre-existing `typebox` missing in extensions

## Commits

_(none yet)_
