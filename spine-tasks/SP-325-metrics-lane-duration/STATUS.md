# SP-325: Task metrics laneNumber and durationMs — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Review current task metric record shape
- [ ] Identify laneNumber source at metric write time

---

### Step 1: Add laneNumber and durationMs to task metrics
**Status:** ⬜ Not Started

- [ ] Extend buildTaskMetricRecord with optional laneNumber, durationMs
- [ ] Pass laneNumber from engine-lanes call sites
- [ ] Compute durationMs from startedAt/endedAt

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Extend metrics tests for new fields
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Note new run-metrics fields in operator-runbook
- [ ] Create .DONE

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
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created (Phase 42) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
