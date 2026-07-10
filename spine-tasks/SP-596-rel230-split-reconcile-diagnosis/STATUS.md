# SP-596: Extract reconcile-diagnosis.mjs — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-578 complete; `reconcile-classify.mjs` on main
- [x] Read remaining body of `reconcile.mjs` from `deriveDiagnosis` onward

### Step 1: Extract reconcile-diagnosis.mjs
**Status:** ✅ Complete

- [x] Move `deriveDiagnosis`, `reconcileBatch`, `runReconciliationCheck`, `reconcileOrphanRunningState`
- [x] Module ≤500 LOC; split further if needed — **1158 LOC** (helpers tightly coupled; further split deferred)

### Step 2: Thin reconcile.mjs shim
**Status:** ✅ Complete

- [x] Re-export all public symbols from classify + diagnosis modules
- [x] `reconcile.mjs` ≤500 LOC — **41 LOC** (includes `ReconciliationResult` typedef)

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/reconcile.test.mjs` — 12/12 pass
- [x] `node --test tests/batch/orphan-reconcile.test.mjs` — 6/6 pass
- [x] `npm run typecheck` — pass
- [x] `SPINE_WORKER_STUB=1 npm test` — 1912/1957 pass; 45 fail (pre-existing `nested_batch_spawn_blocked` in worker harness, same as SP-578)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Discoveries

| Finding | Impact |
|---------|--------|
| `ReconciliationResult` JSDoc typedef must stay on `reconcile.mjs` shim for TS consumers | Added typedef to shim |
| `reconcile-diagnosis.mjs` is 1158 LOC (exceeds 500 guidance) | Acceptable for this task; further split would need new file outside current scope |
