# SP-380: Dashboard Running and Queued columns — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #58 UX/a11y notes

---

### Step 1: UI columns
**Status:** ✅ Complete

- [x] Update view model for runningTaskId and queuedTaskIds
- [x] Render Running and Queued columns with ▶/○ prefixes and aria-labels
- [x] Responsive fallback for narrow widths if needed

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run ui-contract tests
- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Update STATUS with screenshot notes if helpful

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 1 complete | Running + Queued columns in dashboard UI |
| 2026-06-30 | Verification | ui-contract 27/27; full suite 1254/1254; coverage 88.27% |

---

## Blockers

*None*

---

## Notes

- Lane table replaces **Active tasks** with **Running** and **Queued (N)** columns (issue #58 Option A).
- Running cell: `▶ SP-338` with green emphasis and `aria-label="Running task SP-338"`.
- Queued cell: `○ SP-339, ○ SP-341…` with count in column header and per-cell `aria-label` (e.g. `7 tasks waiting in lane queue`).
- Idle lanes show `—` in both columns.
- `resolveLaneQueueProjection` in `view.mjs` prefers SP-379 snapshot fields; falls back to splitting deprecated `activeTaskIds` when lane status is running.
