# SP-606: Split reconcile-diagnosis into batch + orphan — Status

**Current Step:** Step 3
**Status:** ✅ Complete (operator salvage on orch — #192)
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] `reconcile-diagnosis.mjs` was 1158 LOC; public exports via `reconcile.mjs`

### Step 1: Extract / thin
**Status:** ✅ Complete
- [x] `reconcile-batch.mjs` (483), `reconcile-orphan.mjs` (199), `reconcile-light-cache.mjs` (61), `reconcile-diagnosis.mjs` (459)
- [x] Salvage: also split `review-step.mjs` → `review-step-run.mjs` (was 796 ungrandfathered blocker)

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] `node --test tests/batch/reconcile.test.mjs` + `orphan-reconcile.test.mjs` — 18/18
- [x] `node --test tests/batch/review-retry-reconcile.test.mjs` — 6/6
- [x] `npm run typecheck` — pass
- [x] `batch-loc-policy` green with skip-test phase23 verify

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Operator salvage commit on orch; unblocks SP-593 retry

## LOC outcome

| File | LOC |
|------|-----|
| reconcile-diagnosis.mjs | 459 |
| reconcile-batch.mjs | 483 |
| reconcile-orphan.mjs | 199 |
| reconcile-light-cache.mjs | 61 |
| reconcile.mjs | 42 |
| review-step.mjs | 460 |
| review-step-run.mjs | 381 |
