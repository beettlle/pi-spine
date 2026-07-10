# SP-583: Split lane-dirty-check.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for lane-dirty-check.mjs
- [x] List public exports to preserve

### Step 1: Extract lane-dirty-check-git.mjs
**Status:** ✅ Complete

- [x] Create module ≤500 LOC (298 LOC)
- [x] Re-export from lane-dirty-check.mjs

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/gitignored-auto-clean.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Extracted: porcelain parsing, symlink drift, path-in-scope helpers → `lane-dirty-check-git.mjs`
- Deferred to SP-601: gitignored remediation, `resolvePostLaneCommitPorcelain`, thin shim ≤500 LOC
