# SP-316: Attached post-merge SIGTERM land loop — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-21
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #21 timeline reconstructed
- [x] SP-281 coverage gap identified (SIGTERM before finalize; no in-process survival)
- [x] Gate-missing-until-resume confirmed

---

### Step 1: Fix attached post-merge finalize / SIGTERM handoff
**Status:** ✅ Complete

- [x] finalizeBatchForIntegrate on attached last merge (`tryFinalizePostMergeLimbo`)
- [x] SIGTERM handoff to detached engine (`attemptPostMergeLandLoopHandoff`)
- [x] Gate opens without manual resume (in-process finalize on SIGTERM)

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Regression test from batch 20260620T194352
- [x] post-merge-limbo tests updated if needed (no helper changes required)
- [x] FULL test suite passing (1010 tests)
- [x] Coverage gate passes (87.45% ≥77%)

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Operator-runbook updated
- [x] Issue #21 closed
- [x] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| SP-281 finalized after merge but attached engine could still receive parent SIGTERM before exit | Fixed via `installAttachedEngineShutdownHandlers` | `src/batch/attached-engine-handoff.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-20 | Task staged | PROMPT.md and STATUS.md created for GitHub #21 |
| 2026-06-21 | Steps 0–3 complete | SIGTERM handoff, tests, runbook, issue closed |

---

## Blockers

*None*

---

## Notes

Issue #21 timeline: `batch.merge_completed` (20:58:27) → `engine.orphan_terminated` SIGTERM (20:59:28) → gate missing until `batch resume --attached`. Fix: attached engines install SIGTERM/SIGINT handlers that finalize post-merge limbo in-process or spawn detached resume.
