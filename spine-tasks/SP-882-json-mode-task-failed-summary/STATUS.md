# SP-882: Summarize pi --mode json failure output for task.failed journal — Status

**Current Step:** Complete
**Status:** ✅ Finished (outside-spine hotfix)
**Last Updated:** 2026-11-21 (outside-spine hotfix)
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Trace finalizeWorkerOutput → task.failed → capPayloadSize
- [x] Confirm SP-878 text extract API

---

### Step 1: JSON-mode failure summary
**Status:** ✅ Complete

- [x] Detect NDJSON / mode json output
- [x] Replace dump with compact summary + log ref

---

### Step 2: Tests
**Status:** ✅ Complete

- [x] Oversized system-prompt fixture → under 32KiB readable summary

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries in STATUS
- [x] Create .DONE

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
Implemented outside spine batch. finalizeWorkerOutput summarizes NDJSON failures under 32KiB.
