# SP-752: Per-row matrix status, retry, and cancel — Status

**Current Step:** 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Map `task.matrixRows` status fields and journal events
- [x] Map batch retry / cancel entry points and ID parsing

#### Preflight map

- `task.matrixRows`: `[{rowId, status: pending|succeeded|failed, exitCode, commitSha}]`. Set all-pending at `runMatrixTaskOnLane` start (wipes prior attempt), updated after `runConcurrent`; emitted on `matrix.task_failed` / `task.completed` journal payloads. No `running` transition (rows go pending→terminal only at sweep end) and no canceled state today.
- Journal events: `matrix.task_started` (rowIds, matrixMaxParallel, rowConcurrency), `matrix.sub_lane.started|prompt_served|completed|failed`, `matrix.task_failed` (failedRowIds+matrixRows), `matrix.task_completed`; `matrix.task_failed` is already a journal-hint priority type.
- Retry/cancel entry points: `bin/spine-batch.mjs parseBatchArgs` gives `retry`/`skip` a single positional taskId token (`SP-X[rowId]` survives as one token). `retryTask` (phases paused|failed; task failed or pending-with-failed-segment) → `resetTaskForRetry`. `skipTask` = task-level cancel. Batch-level cancel = `abort`. **No row-identity parsing or row-scoped ops exist.**
- Status surfaces: `reconcile-batch.mjs` → `signals.tasks` built via `parseSpineBatchState.normalizeTasks`, which **drops `matrixRows`** (JSON gap); human output in `bin/spine-status.mjs` is batch-level + SBAR with no per-task rows.
- Carry-over constraint: a failed matrix attempt deletes **all** row worktrees+branches, and row worktree/branch names embed the acquired lane slot (`lane-{slot}-{parent}-{row}`) so they are not derivable from the task alone → succeeded rows' `worktreePath`/`branch` must be persisted on `task.matrixRows` entries for retry carry-over.

#### Step 1 design (agreed semantics)

- Row identity `SP-X[rowId]` parsed by `parseMatrixRowRef` (exported from `src/batch/retry.mjs`).
- `retry SP-X[rowId]`: resets only the named failed row→pending (parent task reset as today); other failed rows stay failed (not re-executed). `retry SP-X` (whole task): failed rows→pending, succeeded rows preserved. Resume executes only `pending` rows; `succeeded` rows carry over (reuse kept worktree/branch, no re-execution); `canceled` rows are excluded from execution and aggregation.
- `skip SP-X[rowId]` = cancel one row (row→`canceled`, journal `matrix.row_skipped`); `skip SP-X` cancels the whole matrix (existing task-level skip). Pause-first required while batch is running (standard guard).
- Engine: seed matrixRows (preserve entries), mark rows `running` as they start, persist branch/worktreePath on success, aggregate non-canceled rows, keep succeeded row worktrees on failure as carry-over material, merge carry-over branches on the successful sweep. Fallback: a `succeeded` row whose worktree vanished (crash/manual cleanup) re-executes (never worse than status quo; journaled as `matrix.row_reexecuted`).
- Status: human output renders per-row lines + failing-row ids + retry/cancel hints; JSON `signals.tasks[].matrixRows` restored via `normalizeTasks` passthrough.

---

### Step 1: Status + row retry/cancel
**Status:** ⚪ Not Started

- [ ] Show per-row status under parent
- [ ] Diagnose failing row ids
- [ ] Retry single `SP-X[rowId]`
- [ ] Cancel single row vs whole matrix
- [ ] JSON includes row array when present

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Update runbook §2.4 ops
- [ ] Create `.DONE`

## Amendments

- 2026-09-05: Pre-landed contract redirect — operator-runbook.md already touched by SP-747; mustChange was matrix-run + spine-status.
- 2026-09-05: After SP-751 land, `src/batch/engine-lanes/matrix-run.mjs` is also pre-landed on main — redirect `fileScopeMustChange` to `bin/spine-status.mjs` + `src/batch/retry.mjs` (row status / retry-cancel deliverables).
