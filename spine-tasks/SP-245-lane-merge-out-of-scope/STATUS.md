# Status: SP-245 — Lane merge out-of-scope dependency drift

**Task:** SP-245-lane-merge-out-of-scope
**Started:** 2026-06-14
**Completed:** 2026-06-14

## Progress

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Reconstructed batch `20260614T003849` journal and file scopes

### Step 1: Smart merge

**Status:** ✅ Complete

- [x] `tryAutoResolveMergeConflicts` with lane file scope + branch diff
- [x] Pass lane union scope from `mergeWaveLanesToOrch`
- [x] Prefer orch (`--ours`) for out-of-scope stale paths

### Step 2: Testing & Verification

**Status:** ✅ Complete

- [x] Regression: stale parallel.ts + in-scope index.ts merge succeeds
- [x] In-scope conflict still fails loud
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — 902 pass (2026-06-18)

### Step 3: Documentation & Delivery

**Status:** ✅ Complete

- [x] `.DONE` created

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-14 | Consumer bug report | Batch 20260614T003849 failed on parallel.ts outside lane 2 scope |
| 2026-06-14 | Landed | Out-of-scope auto-resolve in `engine-lanes/merge.mjs` |
