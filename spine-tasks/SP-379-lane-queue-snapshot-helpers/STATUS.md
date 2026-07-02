# SP-379: Lane queue snapshot helpers — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #58 design Tier 1
- [x] Read computeActiveTaskIdsForLane

---

### Step 1: Snapshot helpers
**Status:** ✅ Complete

- [x] Add running/queued helpers using classifiedTasks + lane.taskIds order
- [x] Wire buildLaneRows; populate activeTaskIds as running+queued for compat

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Note deprecated activeTaskIds in STATUS

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
| 2026-07-01 | Step 1 complete | Added computeRunningTaskIdForLane, computeQueuedTaskIdsForLane; wired buildLaneRows |
| 2026-07-01 | Verification | typecheck clean; 1352/1352 tests; coverage gate PASS |

---

## Blockers

*None*

---

## Notes

- **`activeTaskIds` is deprecated** — kept populated as `[runningTaskId, ...queuedTaskIds]` for one release so SP-380 `resolveLaneQueueProjection` fallback and downstream consumers remain compatible.
- **`runningTaskId`**: at most one task with `classification === "running"` in the current wave on the lane.
- **`queuedTaskIds`**: pending-in-wave tasks ordered by `lane.taskIds` (matches engine serialization / `lane.tasks_serialized` journal order).
- SP-380 dashboard UI prefers the new fields via `resolveLaneQueueProjection` in `view.mjs`.
