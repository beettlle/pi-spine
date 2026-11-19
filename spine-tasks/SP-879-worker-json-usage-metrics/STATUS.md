# SP-879: Worker: pi --mode json usage into task metric fields — Status

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

- [ ] Confirm SP-878 API
- [ ] Trace worker → recordLaneTaskMetric path

---

### Step 1: Worker JSON + attach usage
**Status:** ⬜ Not Started

- [ ] --mode json
- [ ] Parse + set task usage before metric

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Mock/fixture stdout → tokens on task record
- [ ] Stub omits fields

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
