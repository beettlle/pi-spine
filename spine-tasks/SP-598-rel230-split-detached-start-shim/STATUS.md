# SP-598: Thin detached-start.mjs shim — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
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
**Status:** 🔄 In Progress
- [ ] Pending

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Pending

## Notes

- Split pattern: spawn (leaf) + diagnostics (leaf) + wait + run; shim re-exports all public API
- `detached-start.mjs` 671 → 32 LOC
