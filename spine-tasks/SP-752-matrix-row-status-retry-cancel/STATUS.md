# SP-752: Per-row matrix status, retry, and cancel — Status

**Current Step:** 3
**Status:** ✅ Complete — .DONE ready
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

- `task.matrixRows`: `[{rowId, status: pending|succeeded|failed|canceled|running, exitCode, commitSha, worktreePath, branch}]`.
- Journal: `matrix.task_started`, `matrix.sub_lane.*`, `task.retry_requested` / skip with `rowId` payload.
- Row ops live in `src/batch/retry-row.mjs` (split from `retry.mjs` for LOC cap); CLI parses `SP-X[rowId]` via `parseMatrixRowRef`.

#### Step 1 design (shipped)

- Row identity `SP-X[rowId]` parsed by `parseMatrixRowRef` in `src/batch/retry-row.mjs`.
- `retry SP-X[rowId]` / `skip SP-X[rowId]` as designed; whole-task paths unchanged.
- Status human + JSON matrixRows; engine marks running, persists worktree/branch on success, carry-over for succeeded rows.

---

### Step 1: Status + row retry/cancel
**Status:** ✅ Complete

- [x] Show per-row status under parent (`bin/spine-status.mjs` appendMatrixRowSections)
- [x] Diagnose failing row ids
- [x] Retry single `SP-X[rowId]` (`retryTaskRow` + CLI)
- [x] Cancel single row vs whole matrix (`skipTaskRow` + CLI)
- [x] JSON includes row array when present

**Recovery note (operator):** Batch `20260905T193305-0705` aborted after thrashing (uncommitted Step 1 WIP). WIP committed as `9b829b9b`; missing `parseMatrixRowRef` + test import path fixed before land.

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint` — exit 0
- [x] Run typecheck — exit 0
- [x] Contract tests: `matrix-execution.test.mjs` + `retry-row.test.mjs` — **53 pass / 0 fail**
- [x] Fix all failures — circular import (retry-row vs retry) + export `parseMatrixRowRef`

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Update runbook §2.4 ops (status / retry / cancel)
- [x] Create `.DONE`

## Amendments

- 2026-09-05: Pre-landed contract redirect — operator-runbook.md already touched by SP-747; mustChange was matrix-run + spine-status.
- 2026-09-05: After SP-751 land, `src/batch/engine-lanes/matrix-run.mjs` is also pre-landed on main — redirect `fileScopeMustChange` to `bin/spine-status.mjs` + `src/batch/retry.mjs` (row status / retry-cancel deliverables).
