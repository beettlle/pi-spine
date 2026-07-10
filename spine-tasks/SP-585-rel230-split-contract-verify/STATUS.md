# SP-585: Split contract-verify.mjs — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings (`spine-tasks/_explore/batch-module-split-v23/findings.md`)
- [x] List public exports to preserve (13 parse exports + 10 exec exports via re-export)

### Step 1: Extract contract-parse.mjs
**Status:** ✅ Complete

- [x] Create `src/batch/contract-parse.mjs` (244 LOC)
- [x] Re-export parse symbols from `contract-verify.mjs`

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/contract-verify-scoped.test.mjs` — 2/2 pass
- [x] `npm run typecheck` — pass
- [x] `SPINE_WORKER_STUB=1 npm test` — 1911 pass; 43 fail (nested_batch_spawn_blocked in worker harness, pre-existing)
- [x] `node --test tests/batch/contract-*.test.mjs tests/batch/stub-contract-enforcement.test.mjs` — 90/90 pass

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Parse half: gating helpers, `listChangedFiles`, `matchesContractPattern`, `verifyStubFileScopeMustChange`
- Exec half deferred to SP-603 (`contract-exec.mjs`)

## Discoveries

| Finding | Action |
|---------|--------|
| `contract-verify.mjs` reduced from 714 → 499 LOC after parse extract | Exec split in SP-603 will thin further |
| Full `npm test` in worker harness fails batch-spawn integration tests | Environmental; contract suite 90/90 green |
