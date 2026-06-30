# SP-378: Attached merge finalize before engine exit — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Run SP-377 fixture (expect fail before fix)
- [x] Read SP-316/SP-358 land loop paths

---

### Step 1: Finalize before exit
**Status:** ✅ Complete

- [x] Ensure attached engine opens gate or spawns detached resume before SIGTERM exit path
- [x] Make SP-377 fixture pass; keep SP-348 regression green

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Close issue #59
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Batch 20260630T212050 limbo: journal has merge_completed but state.mergeResults empty until hydrate | Fixed via hydrateMergeResultsFromJournal | `src/batch/post-merge-limbo.mjs` |
| SP-316 SIGTERM handler used isPostMergeLimbo only; journal-only limbo missed | Complemented by finalizeAttachedLandLoopBeforeExit + attached exit handlers | `src/batch/attached-runner.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-30 | Task staged | PROMPT.md and STATUS.md created |
| 2026-06-30 | Step 0–1 | Journal-aware finalize + SP-377 fixture |
| 2026-06-30 | Step 2 | 1258/1258 tests, coverage 87.81% |
| 2026-06-30 | Step 3 | Issue #59 closed, .DONE created |

---

## Blockers

*None*

---

## Notes

Root cause: attached engine could exit after last-wave journal merges before `mergeResults` was persisted, so SP-316 `isPostMergeLimbo` and wave-merge finalize skipped gate open. Fix hydrates mergeResults from journal, finalizes on normal attached exit and SIGTERM via `finalizeAttachedLandLoopBeforeExit`.
