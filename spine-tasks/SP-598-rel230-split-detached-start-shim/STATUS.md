# SP-598: Thin detached-start.mjs shim — Status

**Current Step:** Step 3
**Status:** ✅ Complete
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-580 complete (`.DONE` present; detached-diagnostics.mjs extracted)

### Step 1: Complete split
**Status:** ✅ Complete
- [x] Move remainder to `detached-wait.mjs` (346 LOC) + `detached-run.mjs` (326 LOC)
- [x] Thin `detached-start.mjs` to 32 LOC re-export shim
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] `node --test tests/batch/detached-start-orphan-timeout.test.mjs` — 2/2 pass
- [x] `npm run typecheck` — pass
- [x] `SPINE_WORKER_STUB=1 npm test` — 44 failures from `SPINE_IS_WORKER=1` nested spawn guard (same as SP-580); detached-start*.test.mjs 34/34 pass without worker env

### Step 3: Documentation & Delivery
**Status:** ✅ Complete
- [x] Create `.DONE`

## Notes

- Split: spawn (leaf) + diagnostics (leaf) + wait + run; shim re-exports all public API
- `detached-start.mjs` 671 → 32 LOC
