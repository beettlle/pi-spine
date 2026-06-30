# SP-379: Lane queue snapshot helpers — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read issue #58 design Tier 1
- [ ] Read computeActiveTaskIdsForLane

---

### Step 1: Snapshot helpers
**Status:** ⬜ Not Started

- [ ] Add running/queued helpers using classifiedTasks + lane.taskIds order
- [ ] Wire buildLaneRows; populate activeTaskIds as running+queued for compat

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Note deprecated activeTaskIds in STATUS

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

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
