# SP-884: Fix live run-metrics tokensIn/tokensOut — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-22
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Trace worker sidecar write → queue read → metric row
- [ ] Trace reviewer usage → buildReviewMetricRecord emit
- [ ] Compare fixture JSON shapes to current pi --mode json samples

---

### Step 1: Fix live usage plumbing
**Status:** ⬜ Not Started

- [ ] Repair worker and/or reviewer path
- [ ] Preserve omit-when-absent
- [ ] Keep #380 sidecar dirty exclusions

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Extend unit/fixture coverage
- [ ] Assert usage keys when provided

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract testCommand passing
- [ ] All failures fixed

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

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
| 2026-11-22 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.34.0 — #377 follow-up to SP-878/879/880.
