# SP-585: Split contract-verify.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
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

- [x] Create `src/batch/contract-parse.mjs` (245 LOC)
- [x] Re-export parse symbols from `contract-verify.mjs`

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/contract-verify-scoped.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Parse half: gating helpers, `listChangedFiles`, `matchesContractPattern`, `verifyStubFileScopeMustChange`
- Exec half deferred to SP-603 (`contract-exec.mjs`)

## Discoveries

| Finding | Action |
|---------|--------|
| `contract-verify.mjs` reduced from 714 → ~470 LOC after parse extract | Exec split in SP-603 will thin further |
