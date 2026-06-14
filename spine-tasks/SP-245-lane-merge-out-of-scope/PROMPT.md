# Task: SP-245 — Lane merge out-of-scope dependency drift

**Created:** 2026-06-14
**Size:** M

## Review Level: 2

**Assessment:** Parallel lanes sharing a dependency task (e.g. SP-001 → parallel.ts) but different file scopes merge stale dependency snapshots into orch and fail the batch despite 0 worker failures.

## Mission

When merging `task/spine-lane-N-*` → `orch/spine-*`, auto-resolve conflicts on paths **outside** the lane's union File Scope when the lane branch did not commit those paths — prefer orch (current) version. Mirrors rules-manifest special case for dependency artifact drift.

**Incident:** pi-web-access batch `20260614T003849` — lane 2 scope `index.ts` only; merge failed on stale `parallel.ts` after lane 1 advanced it on orch.

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/engine-lanes.mjs`
- `tests/batch/lane-merge-out-of-scope.test.mjs`
- `tests/batch/rules-manifest-merge.test.mjs`

## Steps

### Step 0: Preflight

- [x] Reconstruct batch `20260614T003849` journal and file scopes

### Step 1: Smart merge

- [x] `tryAutoResolveMergeConflicts` with lane file scope + branch diff
- [x] Pass lane union scope from `mergeWaveLanesToOrch`
- [x] Prefer orch (`--ours`) for out-of-scope stale paths

### Step 2: Testing & Verification

- [x] Regression: stale parallel.ts + in-scope index.ts merge succeeds
- [x] In-scope conflict still fails loud
- [ ] FULL test suite passing

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Completion Criteria

- [ ] Cross-lane dependency artifact drift no longer fails batch with 0 worker failures

---

## Amendments (Added During Execution)
