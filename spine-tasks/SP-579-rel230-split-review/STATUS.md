# SP-579: Split review.mjs — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Noted existing `review-spawn.mjs` and `review-shared.mjs` — no duplication

### Step 1: Extract review-artifacts.mjs
**Status:** ✅ Complete

- [x] Moved artifact discovery + honor helpers to `src/batch/review-artifacts.mjs` (419 LOC)
- [x] Module ≤500 LOC

### Step 2: Re-export shim
**Status:** ✅ Complete

- [x] Re-exported artifact API from `review.mjs`

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/review-retry-reconcile.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Extracted: `readReviewLevel`, `find*Review*`, honor-signal helpers, `buildReviewHonorHeadlineSuffix`
- Kept in `review.mjs`: `runStepReview`, spawn wiring, `assertReviewToolAvailable`
