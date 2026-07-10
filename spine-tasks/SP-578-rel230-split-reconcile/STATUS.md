# SP-578: Split reconcile.mjs — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings; confirm split boundary at `deriveDiagnosis`
- [x] List public exports to preserve on `reconcile.mjs`

### Step 1: Extract reconcile-classify.mjs
**Status:** ✅ Complete

- [x] Create module with classification + git inspection functions
- [x] Module ≤500 LOC (433 lines)

### Step 2: Re-export shim
**Status:** ✅ Complete

- [x] Re-export from `reconcile.mjs`; remove moved implementations

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/reconcile-light.test.mjs`
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (typecheck pass; full suite 46 failures from `nested_batch_spawn_blocked` in worker harness — reconcile/classify tests pass)

### Step 4: Documentation & Delivery
**Status:** 🔄 In Progress

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Split boundary: `deriveDiagnosis` at line ~943 (pre-split); classify/git helpers through `inspectHumanBaseSync`
- Light-reconcile cache kept in `reconcile.mjs` (used only by `reconcileBatch`)
- Public exports preserved via re-export shim from `reconcile-classify.mjs`
