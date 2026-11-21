# SP-882: Summarize pi --mode json failure output for task.failed journal — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Trace finalizeWorkerOutput → task.failed → capPayloadSize
- [ ] Confirm SP-878 text extract API

---

### Step 1: JSON-mode failure summary
**Status:** ⬜ Not Started

- [ ] Detect NDJSON / mode json output
- [ ] Replace dump with compact summary + log ref

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Oversized system-prompt fixture → under 32KiB readable summary

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
| 2026-11-21 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Release v2.33.1 emergency patch.
