# SP-604: Extract attached-runner-reconcile.mjs — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Confirm SP-586 complete

### Step 1: Complete split
**Status:** ✅ Complete
- [x] Move remainder; thin `attached-runner.mjs` ≤500 LOC
- [x] Preserve all public exports via re-export

### Step 2: Testing & Verification
**Status:** 🟡 In Progress
- [x] `node --test tests/batch/attached-pause-resume-sigterm.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Notes

### Plan (Review Level 1)

1. **Dependency:** SP-586 done on lane-1. Bring promote split into this lane.
2. **Extract:** Move pause/resume remainder into `attached-runner-reconcile.mjs`.
3. **Promote:** Import from reconcile module (avoid shim cycle).
4. **Shim:** Thin re-export facade ≤500 LOC; public API unchanged.

### Discoveries

| Finding | Action |
|---------|--------|
| Lane-2 base still monolithic; SP-586 on lane-1 only | Incorporate promote as dependency baseline |
| GitNexus: `enforceAttachedEngineSingleOwner` CRITICAL | Keep re-exported from `attached-runner.mjs` |
| Plan review Step 0 | skipped (real-pi) |

### LOC after split

| File | LOC |
|------|-----|
| `attached-runner.mjs` | 26 |
| `attached-runner-promote.mjs` | 370 |
| `attached-runner-reconcile.mjs` | 291 |
