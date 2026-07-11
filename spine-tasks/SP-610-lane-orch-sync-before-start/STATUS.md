# SP-610: Lane orch sync before start — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** ✅ Complete

- [x] Missing-sync call site identified
- [x] Dep + shared-scope detection approach chosen

### Step 1: Sync helper + call site

**Status:** ✅ Complete

- [x] Helper in worktree.mjs
- [x] Wired before worker launch

### Step 2: Testing & Verification

**Status:** 🟡 In Progress

- [x] `tests/batch/lane-orch-sync.test.mjs` added
- [ ] Contract testCommand green
- [ ] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 findings

- **Missing sync:** Lanes are provisioned once from orch at batch start (`engine.mjs` → `provisionLaneWorktree`). After each wave, `mergeWaveLanesToOrch` lands lane commits on orch, but subsequent waves reuse the same lane worktrees without merging orch back into the lane. `runTaskOnLane` launches the worker with no orch sync.
- **Detection:** Before worker launch, load deps from `dependencies.json` for the task; for each dep with `status === "succeeded"`, load File Scope via `loadTaskFileScopePaths`; if any path intersects the current task scope, call `syncLaneWorktreeFromOrch` (merge orch → lane). Fail loud on dirty worktree or merge conflict.

### Step 1

- Added `syncLaneWorktreeFromOrch` in `worktree.mjs`
- Added `collectSharedScopeSatisfiedDeps` / `ensureLaneSyncedForSharedScopeDeps` in `engine-lanes.mjs`
- `runTaskOnLane` syncs before `task.started` / worker launch; journals `lane.orch_synced` or fails with `orch_sync_failed`

## Discoveries

| Discovery | Action |
|-----------|--------|
| Same-wave cross-tick shared-scope (dep not yet on orch) not fixed by orch sync | Deferred — planner affinity (out of scope) |
