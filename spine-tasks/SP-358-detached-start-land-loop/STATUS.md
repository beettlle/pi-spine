# SP-358: Detached start land loop finalize — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-06-29
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Batch 20260629T210738 timeline reviewed
- [x] Detached engine exit path traced
- [x] Resume postMergeLimbo detection reviewed

---

### Step 1: Engine finalize before detached exit
**Status:** ✅ Complete

- [x] `finalizeBatchForIntegrate` awaited before engine exit
- [x] `batch.land_loop_finalized` journal event
- [x] `enginePid` cleared after finalize

---

### Step 2: Resume detached fast path reliability
**Status:** ✅ Complete

- [x] `validateResumeBatch` limbo detection broadened
- [x] No second engine spawn on synchronous finalize
- [x] Diagnosis `suggestedCommand` updated

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Detached start land-loop regression test
- [x] Resume --force limbo recovery test
- [x] FULL test suite passing
- [x] Coverage gate passes (≥77%)

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Runbook updated (if needed)
- [x] Issue #41 closed
- [x] `.DONE` created

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Core fix landed in `e722bb0` (SP-358 core + SP-359); task re-staged with fresh STATUS | Re-verified on lane branch | `src/batch/engine.mjs`, `post-merge-limbo.mjs` |
| Batch 20260629T210738 limbo: journal `batch.merge_completed` ×2, empty `mergeResults`, `phase: running` | Fixture in `detached-start-land-loop.test.mjs` | `tests/batch/detached-start-land-loop.test.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-29 | Task staged | PROMPT.md and STATUS.md created for GitHub #41 |
| 2026-06-29 | Step 0 preflight | Engine calls `tryFinalizePostMergeLimbo` then `finalizeBatchForIntegrate` before exit; `detectPostMergeLimboForResume` uses journal/git when `mergeResults` empty |
| 2026-06-29 | Step 3 verification | Contract tests 10/10; full suite 1098/109; coverage 87.14% (threshold 77%) |
| 2026-06-29 | Step 4 delivery | Issue #41 closed; `.DONE` created |

---

## Blockers

*None*

---

## Notes

- **Root cause:** Detached engine exited after `batch.merge_completed` without calling `finalizeBatchForIntegrate`; resume spawned a second engine instead of synchronous limbo finalize when `mergeResults` was empty but journal showed merges done.
- **Fix:** `engine.mjs` land loop finalizes before return; `detectPostMergeLimboForResume` broadened; `resumeBatchDetached` fast path via `finalizeResumePostMergeLimbo`; diagnosis suggests `spine batch resume --force` for post-merge limbo.
