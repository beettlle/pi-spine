# SP-722: Global inter-process lock for batch-state writers — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-25
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code changes.

---

## Step 1: withBatchStateLock helper

**Status:** ⬜ Not Started

- [ ] Add `src/batch/batch-state-lock.mjs` with exclusive lock (wx or flock) under `.spine/runtime/`
- [ ] Document lock ordering: state before history; no nested lock from same process

## Step 2: Wrap writers

**Status:** ⬜ Not Started

- [ ] Wrap `saveSpineBatchState` and `appendBatchHistoryEntry` under the lock
- [ ] Wrap abort / lifecycle writers that touch batch-state or history
- [ ] Document resume handoff lock relationship (unified or subset)

## Step 3: Concurrent tests

**Status:** ⬜ Not Started

- [ ] Add `tests/batch/batch-state-lock.test.mjs` — concurrent writers, no lost updates
- [ ] Keep existing resume/concurrent suites green when run in Testing step

## Step 4: Testing & Verification

**Status:** ⬜ Not Started

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

## Step 5: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

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

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
