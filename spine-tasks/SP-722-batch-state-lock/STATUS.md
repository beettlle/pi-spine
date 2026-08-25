# SP-722: Global inter-process lock for batch-state writers — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-08-25
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: withBatchStateLock helper

**Status:** ✅ Complete

- [x] Add `src/batch/batch-state-lock.mjs` with exclusive lock (wx or flock) under `.spine/runtime/`
- [x] Document lock ordering: state before history; no nested lock from same process

## Step 2: Wrap writers

**Status:** ✅ Complete

- [x] Wrap `saveSpineBatchState` and `appendBatchHistoryEntry` under the lock
- [x] Wrap abort / lifecycle writers that touch batch-state or history
- [x] Document resume handoff lock relationship (unified or subset)

## Step 3: Concurrent tests

**Status:** ✅ Complete

- [x] Add `tests/batch/batch-state-lock.test.mjs` — concurrent writers, no lost updates
- [x] Keep existing resume/concurrent suites green when run in Testing step

## Step 4: Testing & Verification

**Status:** ✅ Complete

- [x] Run contract `testCommand` only
- [x] Fix all failures from the scoped contract command (no failures; typecheck clean, 6/6 pass)

## Step 5: Documentation & Delivery

**Status:** ✅ Complete

- [x] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-25 | Task staged | PROMPT.md and STATUS.md created for v2.16.0 release |
| 2026-08-25 | Step 1 complete | `src/batch/batch-state-lock.mjs`: `withBatchStateLock` — `wx` lock at `.spine/runtime/batch-state.lock`, PID-liveness + TTL stale break, re-entrant per process, lock ordering documented |
| 2026-08-25 | Step 2 complete | `saveSpineBatchState` / `appendBatchHistoryEntry` wrapped (guard+write TOCTOU closed); `abortBatch` terminal section + `writeAbortSignal` (now atomic) wrapped; `completeBatch` / `dismissBatch` terminal write sections wrapped |
| 2026-08-25 | Step 3 complete | `tests/batch/batch-state-lock.test.mjs`: 6 tests incl. 4-process × 25-iteration concurrent RMW — no lost state markers or history entries; resume-concurrent / complete-engine / state-handoff suites green (15/15) |
| 2026-08-25 | Step 4 complete | Contract `testCommand` green: `npm run typecheck` clean, lock test 6/6 pass |
| 2026-08-25 | Step 5 complete | operator-runbook.md reviewed — lock is transparent to operators, no semantics change documented; `.DONE` created |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes

Plan (Level 2):
- `src/batch/batch-state-lock.mjs`: `withBatchStateLock(projectRoot, fn)` — exclusive `wx` create on `.spine/runtime/batch-state.lock`, PID-liveness stale breaking, bounded sync wait (Atomics.wait poll), same-process re-entrant pass-through (no nested acquisition).
- Lock ordering doc: resume handoff lock (per-batch) may be held while acquiring the global lock; never the reverse. Within global lock: state writes before history writes.
- Wrap `saveSpineBatchState` (guard-eval + write TOCTOU included) and `appendBatchHistoryEntry` internally in `state-io.mjs`; wrap `writeAbortSignal` + abort terminal write section in `abort.mjs`; wrap complete/dismiss terminal write sections in `lifecycle.mjs`.
- Test: multi-process child writers doing locked load→mutate→save plus unlocked concurrent `appendBatchHistoryEntry`; assert no lost markers/entries. Plus stale-lock break, re-entrancy, contention wait tests.
