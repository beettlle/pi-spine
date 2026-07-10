# SP-604: Extract attached-runner-reconcile.mjs — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-586 complete

### Step 1: Complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `attached-runner.mjs` ≤500 LOC
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] `node --test tests/batch/attached-pause-resume-sigterm.test.mjs` (5/5 pass)
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (typecheck OK; unset `SPINE_IS_WORKER` for nested-batch fixtures; 1952/1954 pass — 2 pre-existing phase23 failures on `review-step.mjs` >500, unrelated)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Notes

### Plan (Review Level 1)

1. Bring SP-586 promote split into this lane.
2. Extract pause/resume remainder into `attached-runner-reconcile.mjs`.
3. Promote imports from reconcile (no shim cycle).
4. Thin re-export facade ≤500 LOC; public API unchanged.

### Discoveries

| Finding | Action |
|---------|--------|
| Lane-2 base still monolithic; SP-586 on lane-1 only | Incorporate promote as dependency baseline |
| GitNexus: `enforceAttachedEngineSingleOwner` CRITICAL | Keep re-exported from `attached-runner.mjs` |
| Plan review Step 0 | skipped (real-pi) |
| Full suite under `SPINE_IS_WORKER=1` fails nested batch fixtures | Unset for verification (same as SP-586) |

### LOC after split

| File | LOC |
|------|-----|
| `attached-runner.mjs` | 26 |
| `attached-runner-promote.mjs` | 370 |
| `attached-runner-reconcile.mjs` | 291 |

## Completion Criteria

- [x] `attached-runner.mjs` ≤500 LOC; API unchanged
