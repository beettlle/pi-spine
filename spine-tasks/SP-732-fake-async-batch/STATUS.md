# SP-732: Remove fake-async in batch merge, queue, review-spawn — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-08-28
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** ✅ Complete

- [x] Confirm disjoint scope from SP-731
- [x] Read #270 batch criteria

## Step 1: Remove fake-async on batch exports

**Status:** ✅ Complete

- [x] Fix mergeWaveLanesToOrch, skipTaskDoneOnDisk, spawnReviewerPi
- [x] Update importers if needed

## Step 2: Optional arch guard

**Status:** ✅ Complete

- [x] Add tests/arch/fake-async.test.mjs (optional)

## Step 3: Testing & Verification

**Status:** ✅ Complete

- [x] Run lint
- [x] Run Contract `testCommand`

## Step 4: Documentation & Delivery

**Status:** ✅ Complete

- [x] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Step 0 complete | Scope disjoint from SP-731 (CLI paths); #270 read — all 3 batch targets confirmed fake-async or redundant-async |
| 2026-08-28 | Steps 1-2 complete | 3 exports de-asynced; engine.mjs lane-run union type widened; arch guard added; commit eacdea37 |
| 2026-08-28 | Step 3 complete | lint clean; typecheck clean; scoped batch tests 39/39 pass; arch guard 5/5 pass |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
