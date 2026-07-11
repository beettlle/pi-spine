# SP-610: Lane orch sync before start — Status

**Current Step:** Step 0 — Preflight
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Steps

### Step 0: Preflight

**Status:** 🟡 In Progress

- [x] Missing-sync call site identified
- [x] Dep + shared-scope detection approach chosen

### Step 1: Sync helper + call site

**Status:** ⬜ Not Started

- [ ] Helper in worktree.mjs
- [ ] Wired before worker launch

### Step 2: Testing & Verification

**Status:** ⬜ Not Started

- [ ] `tests/batch/lane-orch-sync.test.mjs` added
- [ ] Contract testCommand green
- [ ] Full suite + coverage gate

### Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

### Step 0 findings

- **Missing sync:** Lanes are provisioned once from orch at batch start (`engine.mjs` → `provisionLaneWorktree`). After each wave, `mergeWaveLanesToOrch` lands lane commits on orch, but subsequent waves reuse the same lane worktrees without merging orch back into the lane. `runTaskOnLane` launches the worker with no orch sync.
- **Detection:** Before worker launch, load deps from `dependencies.json` for the task; for each dep with `status === "succeeded"`, load File Scope via `loadTaskFileScopePaths`; if any path intersects the current task scope, call `syncLaneWorktreeFromOrch` (merge orch → lane). Fail loud on dirty worktree or merge conflict.
- **Plan (Review Level 1):** Add sync helper in `worktree.mjs`; wire in `runTaskOnLane` after scope load / before worker; regression test with ancestor check for shared-path dep across lanes.

## Discoveries

| Discovery | Action |
|-----------|--------|
| Same-wave cross-tick shared-scope (dep not yet on orch) not fixed by orch sync | Deferred — planner affinity (out of scope) |
