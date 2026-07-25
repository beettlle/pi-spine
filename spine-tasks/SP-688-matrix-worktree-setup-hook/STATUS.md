# Task Status: SP-688 — Run worktreeSetupHook for matrix sub-lanes

## Current State

**Overall Status:** ✅ Complete (pending .DONE)

## Steps

### Step 0: Preflight
**Status:** ✅ Done
- [x] Confirm missing hook on matrix provision path
  - `provisionMatrixSubLaneWorktree` (matrix.mjs) only does `worktree add` + git path normalize — no hook.
  - Parent lanes call `runWorktreeSetupHook` with `SPINE_PROJECT_ROOT` / `SPINE_WORKTREE` env (engine.mjs ~L235).

### Step 1: Invoke setup hook on matrix sub-lanes
**Status:** ✅ Done
- [x] Wire `runWorktreeSetupHook` after matrix worktree provision
  - Added `runMatrixSubLaneSetupHook` helper in `matrix.mjs` (centralizes `matrix.sub_lane.setup_hook.*` events, mirrors parent-lane provision→hook sequence). No-op when unconfigured.
  - Called it in `runMatrixSubLane` (matrix-run.mjs) right after provision + `matrix.sub_lane.started`, before execute/LLM dispatch.
- [x] Pass required env (`projectRoot`, `worktreePath`, config)
  - Helper delegates to `runWorktreeSetupHook` which sets `SPINE_PROJECT_ROOT` / `SPINE_WORKTREE` / `SPINE_BATCH_ID` / `SPINE_LANE_NUMBER`.
- [x] Fail closed: surface hook failure on the matrix row
  - On hook throw, `runMatrixSubLane` journals `matrix.sub_lane.failed` and returns `{ok:false}` for the row (does not continue into `runCommand`).

### Step 2: Testing & Verification
**Status:** ✅ Done
- [x] Regression in `tests/batch/matrix-execution.test.mjs`
  - New E2E: hook materializes a gitignored marker; each row's output carries `HOOK_OK` evidence + journal `setup_hook.completed` fires per row → proves hook ran in each sub-lane worktree before execute.
  - New unit: helper is no-op when unconfigured; fail-closed throws + journals `setup_hook.failed` with row id when hook returns `ok:false`.
- [x] Contract `testCommand` green
  - `npm run typecheck` → clean (no errors).
  - `node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs` → 21/21 pass (incl. 4 matrix E2E, 2 new unit tests).

### Step 3: Documentation & Delivery
**Status:** ✅ Done
- [x] `.DONE` (created below)

## Design notes

- Kept change **additive** to respect the PROMPT "HIGH blast radius — keep change minimal" directive: no existing function signature changed (`provisionMatrixSubLaneWorktree` contract untouched; impact was HIGH purely from call-chain depth).
- Mirrored the parent-lane pattern (provision separate from hook) rather than bundling the hook into the provision function.
- `runMatrixSubLaneSetupHook` lives in `matrix.mjs` alongside `recordMatrixEvent` (the stated home for centralized `matrix.*` event types); re-exported through the `engine-lanes.mjs` facade.
- Parent-lane hook behavior unchanged (engine.mjs untouched).

## Discoveries

| Area | Finding |
|------|---------|
| Impact | `runMatrixSubLane` LOW risk (additive call site); `provisionMatrixSubLaneWorktree` HIGH risk from call depth only — contract left unchanged. |
| `detect_changes` | All affected flows are `RunMatrixSubLane → …` (the intended production matrix provision path); no parent-lane or scheduling flows affected. |
