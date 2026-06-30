# SP-343: Attached batch exit after complete — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #34 reviewed
- [x] File scope modules read

**Plan (Step 1):** Root cause is attached CLI never calls `process.exit(0)` on success (`writeCommandResult` only exits on failure) and engine journal milestones were not streamed to stdout. Add `attached-runner.mjs` milestone reporter + `finishAttachedBatchCli`, wire `spine-batch.mjs` attached start/resume paths.

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
| 2026-06-28 | Task staged | PROMPT.md and STATUS.md created for GitHub #34 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
