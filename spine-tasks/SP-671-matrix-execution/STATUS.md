# SP-671: Execute matrix sub-lanes in parallel worktrees — Status

**Current Step:** Complete
**Status:** ✅ Ready for .DONE
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Required files and paths exist
- [x] SP-670 and SP-672 landed on `main`

**Preflight notes:** SP-670 (matrix substitution: `substituteMatrixVariables`, `applyMatrixRowToSteps`, `applyMatrixRowToContract`) and SP-672 (execution-only runner: `Type: execute`, `spawnExecutionOnlyHandle`, `runWorker` execute path) both on `main` and present in this worktree branch. `src/planner/matrix.mjs`, `src/batch/contract-verify.mjs` (`verifyContract({matrixRow})`), and `parse-prompt.mjs` (`prompt.matrix`/`matrixColumns`) all available.

---

### Step 1: Provision worktree per matrix row
**Status:** ✅ Complete

- [x] Add worktree provisioning for sub-lanes
- [x] Deterministic naming from sub-lane ID
- [x] Reuse setup/cleanup

**Implementation:** `src/batch/engine-lanes/matrix.mjs` — `loadMatrixTaskRows`, `slugifyMatrixToken`, `matrixWorktreeDir`/`matrixWorktreePath`/`matrixSubLaneBranch`, `provisionMatrixSubLaneWorktree`/`removeMatrixSubLaneWorktree`/`removeAllMatrixSubLaneWorktrees`. Worktrees named `lane-{n}-{parentSlug}-{rowSlug}` (matches PROMPT example). Reuses `git worktree add` + `normalizeLaneWorktreeGitPaths`.

---

### Step 2: Run sub-lanes in parallel up to maxParallel
**Status:** ✅ Complete

- [x] Schedule each row as sub-lane
- [x] Respect maxParallel
- [x] Run substituted command per row
- [x] Track per-row status

**Implementation:** `src/batch/engine-lanes.mjs` — early matrix dispatch in `runTaskOnLane`; `runMatrixTaskOnLane` + `runMatrixSubLane` fan out rows via `runConcurrent(rows, maxParallel)`. Per-row: provision worktree off the lane task branch, substitute runCommand (execute) or delegate to `runWorker` (llm), commit row output, verify contract per row via `verifyContract({matrixRow})`. `engine.mjs` passes cleanup of matrix row worktrees on batch failure.

---

### Step 3: Aggregate sub-lane outcomes
**Status:** ✅ Complete

- [x] Parent task success if all rows succeed
- [x] Parent task failure if any row fails
- [x] Surface failing row
- [x] Write per-row status to journal or nested state
- [x] `spine status` shows aggregated state

**Implementation:** `aggregateMatrixOutcomes` derives parent outcome; `task.matrixRows[]` carries per-row status in state; `matrix.*` journal events (`task_started`, `sub_lane.started/completed/failed`, `task_completed/task_failed`) recorded. Success merges each row branch into the lane worktree → normal lane-commit + wave-merge carry all rows' output. `journal.mjs` summarizes `rowId`/`failedRowIds` and surfaces `matrix.task_failed` in diagnosis hints.

---

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] `npm run typecheck` passes
- [x] Matrix execution e2e test passes
- [x] Failing row fails whole task test passes
- [x] maxParallel limit test passes
- [x] All failures fixed

**Evidence:** contract `testCommand` (`npm run typecheck && node --test tests/batch/matrix-execution.test.mjs`) → 18/18 pass. Broad regression (`tests/batch/*.test.mjs tests/planner/*.test.mjs`, SPINE_IS_WORKER unset) → **1378/1378 pass, 0 fail**. The only test that fails inside the live worker session is `engine-lane-execution.test.mjs` with `nested_batch_spawn_blocked` — environmental (SPINE_IS_WORKER=1), pre-existing, and passes once the worker env is cleared.

---

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] STATUS.md updated
- [x] Notes captured for SP-673

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `buildPlan` (planner/index.mjs) does NOT copy `matrix`/`matrixColumns` from the packet into its `tasksById`; `assignLanesToWaves` therefore never sees `task.matrix` in production. SP-669's planner expansion (`SP-100[a]` sub-lane IDs) is inert outside unit tests that hand-construct `tasksById`. | SP-671 drives matrix execution from the ENGINE (read packet at task-run time), not from planner sub-lane IDs. State keeps the parent task as a single entry; rows fan out internally. | `src/planner/index.mjs`, `src/planner/waves.mjs` |
| `worker-host.mjs` runWorker execute path does NOT substitute `{matrix.X}` in runCommand before spawning. worker-host.mjs is NOT in File Scope. | Matrix execute rows substitute the runCommand in-engine (`substituteMatrixVariables`) and run directly via spawn in the per-row worktree. llm-type rows delegate to runWorker; per-row agent-prompt substitution is noted for SP-673 (worker-host). | `src/batch/worker-host.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-19 | Preflight + design investigation | Deps on main; design decision: engine-driven matrix fan-out |
| 2026-07-19 | Implemented Steps 1-3 | New `engine-lanes/matrix.mjs` + dispatch in facade; engine/journal/lane-commit matrix-aware |
| 2026-07-19 | Wrote `tests/batch/matrix-execution.test.mjs` | 16 tests pass (3 e2e + 13 unit) |

---

## Blockers

*None*

---

## Notes

### Plan (Review Level 1 — Plan Only)

**Core insight:** Because `buildPlan` drops `matrix`, the engine sees each matrix task (`SP-100`) as a single task. SP-671 detects the matrix from the packet at run time and fans out rows internally — no manipulation of planner sub-lane IDs, `countPlanTasks`, `buildTaskLaneAssignments`, or `assessWaveMergeEligibility`. This keeps blast radius to the four in-scope batch files + a new helper module.

**Architecture:**

1. **New module `src/batch/engine-lanes/matrix.mjs`** (pure helpers + provisioning; re-exported via the `engine-lanes.mjs` facade):
   - `loadMatrixTaskRows(taskFolderPath)` → `{ rows: [{rowId, values}], columns, type } | null`. Reads parent packet (`loadTaskPacket` → `parsePrompt`). `null` for non-matrix tasks.
   - `slugifyMatrixToken(s)` → `[a-z0-9_]+` for worktree/branch naming.
   - `matrixWorktreeDir(laneNumber, parentTaskId, rowId)` → `lane-{n}-{parentSlug}-{rowSlug}` (matches PROMPT example `lane-1-sp-669-a_shell_a`).
   - `matrixWorktreePath(projectRoot, batchId, laneNumber, parentTaskId, rowId)`.
   - `matrixSubLaneBranch(batchId, laneNumber, parentTaskId, rowId)`.
   - `provisionMatrixSubLaneWorktree({projectRoot, batchId, laneNumber, parentTaskId, rowId, baseRef})` → `git worktree add -b rowBranch rowWt baseRef` + `normalizeLaneWorktreeGitPaths` (reuse from worktree.mjs).
   - `removeMatrixSubLaneWorktree(...)`.
   - `runConcurrent(items, limit, workerFn)` → generic concurrency-limited map (enforces maxParallel). Unit-testable for the limit.

2. **`src/batch/engine-lanes.mjs`** (facade) — early matrix dispatch in `runTaskOnLane`:
   - After resolving file scope, call `loadMatrixTaskRows(parentTaskFolder)`. If matrix → `return runMatrixTaskOnLane({...})`.
   - Add `runMatrixTaskOnLane`: (a) init `task.matrixRows[]` pending; (b) journal `matrix.task_started`; (c) `runConcurrent(rows, maxParallel, runMatrixSubLane)`; (d) aggregate.

3. **`runMatrixSubLane`** (per row, in matrix.mjs):
   - Provision per-row worktree off the lane task branch (`lane.branch`).
   - Journal `matrix.sub_lane.started { rowId }`.
   - **execute type**: substitute `runCommand` (or `testCommand`) via `substituteMatrixVariables(cmd, row.values)`; run via `/bin/sh -c` in row worktree; capture exit/output.
   - **llm type**: delegate to `runWorker` in row worktree (agent-prompt substitution deferred to SP-673).
   - On success: commit row worktree to row branch (`feat({taskId}[{rowId}]: ...`); record `matrixRows[i].status="succeeded"`; journal `matrix.sub_lane.completed { rowId, commitSha }`.
   - On failure: record `matrixRows[i].status="failed"` + `exitReason`; journal `matrix.sub_lane.failed { rowId, exitCode, output }`; cleanup row worktree.

4. **Aggregation** (in `runMatrixTaskOnLane`, Step 3):
   - `failedRows = matrixRows.filter(failed)`.
   - If any failed → `task.status="failed"`, `task.exitReason="matrix_sub_lane_failed:<rowIds>"`, journal `task.failed` with failing rowIds; cleanup remaining row worktrees; return `{ ok:false, workerResult:{...} }`.
   - If all succeeded → merge each row branch into the lane task branch (clean for disjoint file scopes — the matrix design intent), update lane worktree, touch `.DONE` in parent task folder, cleanup row worktrees; journal `matrix.task_completed`; return `{ ok:true }` so the normal lane-commit + wave-merge proceed.

5. **`src/batch/journal.mjs`** (Step 3) — add `recordMatrixSubLaneEvent(projectRoot, batchId, type, payload)` helper emitting the `matrix.*` event types, plus register them in any status/derivation sets so `spine status` shows per-row detail. Parent aggregate status derived from `task.matrixRows`.

6. **`src/batch/lane-commit.mjs`** (Step 3) — `commitLaneWorktree` already commits the lane worktree; the matrix path pre-merges row branches so the lane worktree carries all rows' output before this runs. Add handling so the commit message / dirty check tolerate the merged row state (verify contract with `matrixRow` aggregation). Minimal: ensure `fileScopeMustChange` resolution works post-row-merge.

7. **`src/batch/engine.mjs`** (Step 2) — pass `config.lanes.maxParallel` explicitly into `runTaskOnLane` call site and add matrix row-worktree cleanup in the batch abort / catch path (alongside `removeLaneWorktrees`).

**Tests (`tests/batch/matrix-execution.test.mjs`, mirrors `execution-only.test.mjs`):**
- e2e: matrix task (Type: execute, 2 rows, `{matrix.run_id}`) produces 2 output files; assert orch branch has both.
- failing row: one row's command exits non-zero → task.failed, batch not ok, failing rowId recorded.
- maxParallel: unit-test `runConcurrent` peak concurrency === limit; integration assertion that rows respect the limit.
- provisioning: `matrixWorktreePath`/`matrixSubLaneBranch` determinism + slug sanitization.
- loadMatrixTaskRows: null for non-matrix, rows for matrix.

**Coverage target ≥77%** on changed code (matrix.mjs + dispatch).

**Out of scope (noted for SP-673):** llm-type agent-prompt substitution inside the worker; planner-side `buildPlan` matrix copy (currently inert); runbook.

### Deferred to SP-673 (operator runbook + gaps)

1. **llm-type matrix rows:** `runMatrixSubLane` delegates to `runWorker` in the row worktree, but the agent does not yet receive a substituted PROMPT/contract for its row. Per-row agent-prompt substitution (e.g. `SPINE_MATRIX_ROW` env consumed by the worker + `applyMatrixRowToSteps`/`applyMatrixRowToContract`) should be wired in the worker boundary (`worker-host.mjs`, out of SP-671 file scope). The execute-type path is fully substituted and is the deterministic, tested path.
2. **Planner matrix propagation:** `buildPlan` (planner/index.mjs) does not copy `matrix`/`matrixColumns` into `tasksById`, so `assignLanesToWaves` never expands matrix in production. SP-671 works around this by reading the packet at engine run time. SP-673 (or a planner task) can make the planner fan out matrix rows into virtual lanes so cross-task maxParallel packing considers matrix dimensions.
3. **`spine status` per-row rendering:** per-row status is written to state (`task.matrixRows[]`) and the journal (`matrix.*` events, now summarized). SP-673 runbook/dashboard can render the aggregated matrix state + per-row detail explicitly.
4. **Matrix + final/code review:** the matrix path runs per-row `verifyContract` but skips the `runCodeReviewPhase`/`runFinalReviewPhase` engine phases (consistent with execution-only tasks). If llm matrix tasks need review, wire per-row or post-aggregation review.
