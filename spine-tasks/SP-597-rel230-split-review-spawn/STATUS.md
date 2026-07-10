# SP-597: Extract review-spawn remainder — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-579 complete (`.DONE` present; artifact API extracted)

### Step 1: Extract spawn remainder
**Status:** ✅ Complete

- [x] Moved `runStepReview`, honor/spawn completion paths to `src/batch/review-step.mjs` (797 LOC)
- [x] `review.mjs` now 57 LOC (≤500)

### Step 2: Re-export shim
**Status:** ✅ Complete

- [x] All public exports preserved via `review.mjs` facade

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] Pending

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Pending

## Notes

- Plan: extract spawn orchestration to `review-step.mjs`; keep `review-spawn.mjs` as low-level pi child spawn.
