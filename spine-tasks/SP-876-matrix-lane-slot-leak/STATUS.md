# SP-876: Matrix: release lane slot if state save throws; do not swallow packet load errors — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm acquire/save/finally order
- [ ] Trace loadMatrixTaskRows null path

---

### Step 1: Slot + packet fail-closed
**Status:** ⬜ Not Started

- [ ] Always release acquired slots
- [ ] Propagate packet load errors

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Save throw releases slot
- [ ] Broken packet fails closed

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract testCommand
- [ ] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries in STATUS
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
| 2026-11-19 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.33.0 scope (bug-only).
