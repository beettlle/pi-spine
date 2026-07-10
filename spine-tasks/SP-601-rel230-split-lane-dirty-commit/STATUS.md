# SP-601: Extract lane-dirty-check commit paths — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-583 complete (lane-2 `.DONE`; `lane-dirty-check-git.mjs` brought into this lane)

### Step 1: Extract / complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `lane-dirty-check.mjs` ≤500 LOC (141 LOC)
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] `node --test tests/batch/gitignored-auto-clean.test.mjs` — 12/12 pass
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — typecheck pass; 1910 pass / 44 fail (pre-existing `nested_batch_spawn_blocked` under `SPINE_IS_WORKER=1`); 37/37 related dirty-check regressions pass

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Completion Criteria

- [x] `lane-dirty-check.mjs` ≤500 LOC (141); API unchanged via re-exports

## Notes

- Plan review skipped (real-pi nested spawn blocked; engine reviews after `.DONE`).
- Modules: `lane-dirty-check-git.mjs` (298), `lane-dirty-check-commit.mjs` (361), shim (141).
- Flutter analyze helpers remain in the shim; gitignored + `resolvePostLaneCommitPorcelain` + coverage sanitize/restore in commit module.
