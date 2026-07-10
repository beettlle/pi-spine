# SP-584: Split journal-rebuild.mjs — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for journal-rebuild.mjs (`spine-tasks/_explore/batch-module-split-v23/findings.md`)
- [x] List public exports to preserve (15 exports via journal-rebuild.mjs re-export shim)

### Step 1: Extract journal-rebuild-structural.mjs
**Status:** ✅ Complete

- [x] Create module ≤500 LOC (`journal-rebuild-structural.mjs` — 352 LOC)
- [x] Re-export from journal-rebuild.mjs

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `node --test tests/batch/reconcile-done-inlane-terminal.test.mjs` — 5/5 pass
- [x] `npm run typecheck` — pass
- [x] `SPINE_WORKER_STUB=1 npm test` — 44 failures from `SPINE_IS_WORKER=1` nested-batch guard (environmental); all 32 journal-rebuild tests pass

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Split boundary: structural derivation → `journal-rebuild-structural.mjs`; drift reconcile stays in `journal-rebuild.mjs` for SP-602
- GitNexus impact: CRITICAL upstream on rebuildBatchStateFromJournal — expected for refactor-only re-export split
