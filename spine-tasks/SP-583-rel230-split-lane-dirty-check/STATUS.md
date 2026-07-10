# SP-583: Split lane-dirty-check.mjs — Status

**Current Step:** Complete
**Status:** ✅ Complete
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
**Status:** ✅ Complete

- [x] `node --test tests/batch/gitignored-auto-clean.test.mjs` — 12/12 pass
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — typecheck pass; full suite 1909 pass / 45 fail (pre-existing worker-env batch spawn blocks)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Create `.DONE`

## Completion Criteria

- [x] First-half extract complete; second half deferred to paired task SP-601

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Extracted: porcelain parsing, symlink drift, path-in-scope helpers → `lane-dirty-check-git.mjs` (298 LOC)
- `lane-dirty-check.mjs` now 484 LOC (thin shim deferred to SP-601)
- All 49 lane-dirty-check regression tests pass
