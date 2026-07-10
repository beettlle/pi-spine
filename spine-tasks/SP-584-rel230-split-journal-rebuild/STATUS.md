# SP-584: Split journal-rebuild.mjs — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for journal-rebuild.mjs (`spine-tasks/_explore/batch-module-split-v23/findings.md`)
- [x] List public exports to preserve (15 exports via journal-rebuild.mjs re-export shim)

### Step 1: Extract journal-rebuild-structural.mjs
**Status:** 🔄 In Progress

- [x] Create module ≤500 LOC (`journal-rebuild-structural.mjs` — 359 LOC)
- [x] Re-export from journal-rebuild.mjs

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Pending

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Pending

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Split boundary: structural derivation (timeline, deriveStructuralBatchStateFromJournal, rebuildBatchStateFromJournal) → structural module; drift reconcile stays in journal-rebuild.mjs for SP-602
- GitNexus impact: CRITICAL upstream on rebuildBatchStateFromJournal — expected for refactor-only re-export split
