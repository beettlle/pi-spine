# SP-602: Extract journal-rebuild-drift.mjs — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-11
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-584 complete (`.DONE` present; structural module 352 LOC)

### Step 1: Extract / complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `journal-rebuild.mjs` ≤500 LOC (shim 28 LOC; drift 397 LOC)
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] `node --test tests/batch/done-marker-fail-closed.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230) — second half after SP-584 structural extract
- Extracted drift/done-marker/orphan-review → `journal-rebuild-drift.mjs`; shim re-exports structural + drift
- GitNexus impact: CRITICAL upstream on detectBatchStateDrift / reconcileBatchStateDrift — expected for refactor-only re-export split (same as SP-584)
- Amendment: delivery proof is new `journal-rebuild-drift.mjs`
- Plan review: skipped (real-pi; engine reviews after `.DONE`)
- Targeted tests: done-marker + journal-rebuild-drift + journal-rebuild — 10/10 pass
