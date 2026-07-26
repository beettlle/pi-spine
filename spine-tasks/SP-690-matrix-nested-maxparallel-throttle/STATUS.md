# Task Status: SP-690 — Cap nested matrix concurrency to remaining slots

## Current State

**Overall Status:** 🟡 In Progress

**Operator amendment:** SP-688 pre-landed changes in the shared matrix paths. Contract delivery proof now targets this task's `.DONE`; production wiring, regression coverage, and runbook updates remain required.

**Retry amendment:** Wave 1 exposed SP-689's incompatible virtual-row planning (`task_not_found`). Retry must restore parent-task planning, retain the SP-690 throttle, and pass planner plus matrix E2E tests.

## Steps

### Step 0: Preflight
**Status:** ✅ Done
- [x] Confirm nested full-`maxParallel` overshoot and SP-688 landed
  - `engine-lanes.mjs` passes `maxParallel: config?.lanes?.maxParallel ?? 1` into `runMatrixTaskOnLane` → `runConcurrent` (parent lane held in parallel).
  - SP-688 landed: commit f256c7b5 (#224 setup hook) present in history; `runMatrixSubLaneSetupHook` wired into `runMatrixSubLane`.

### Step 1: Throttle nested matrix concurrency
**Status:** ✅ Done
- [x] Compute remaining slots when parent holds a lane (interim: `max(1, maxParallel - 1)`, parent lane = 1 occupied slot) — `matrixRowConcurrencyLimit` in `matrix-run.mjs`
- [x] Pass throttled limit into `runConcurrent` from production `runTaskOnLane` caller — `engine-lanes.mjs` now calls `matrixRowConcurrencyLimit(global, 1)` and passes the result as `maxParallel`
- [x] Preserve fail-closed row failure behavior; matrix abort semantics untouched (only the concurrency VALUE changed)

### Step 2: Testing & Verification
**Status:** ✅ Done
- [x] Remove SP-689's incompatible `buildPlan` matrix propagation so production execution retains the parent task ID until #228 adds first-class row scheduling
- [x] Update the planner regression to assert matrix metadata does not create engine-visible virtual task IDs (`plan-matrix.test.mjs`)
- [x] Regression: mixed wave (matrix + sibling) cannot exceed `lanes.maxParallel` — E2E asserts `matrix.task_started.maxParallel === 1` (global 2) + unit formula tests for `matrixRowConcurrencyLimit`
- [x] Run contract `testCommand` only (scoped) — 30/30 pass (typecheck clean)
- [x] Fix all failures from the scoped contract command — 4 baseline `task_not_found` E2E failures → 0

### Step 3: Documentation & Delivery
**Status:** ✅ Done
- [x] Document interim global in-flight ≤ `maxParallel` invariant and that #228 may supersede the throttle — `docs/adoption/operator-runbook.md` §2.4 (plan output, concurrency, planner-packing caveat) + `docs/QUICK-REFERENCE.md` matrix note
- [x] Create `.DONE`
