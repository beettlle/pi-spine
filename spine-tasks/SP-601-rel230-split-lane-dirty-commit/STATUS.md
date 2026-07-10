# SP-601: Extract lane-dirty-check commit paths — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
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
**Status:** 🟡 In Progress
- [x] `node --test tests/batch/gitignored-auto-clean.test.mjs` — 12/12 pass
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`

## Notes

- Plan review skipped (real-pi nested spawn blocked; engine reviews after `.DONE`).
- Blast radius: `classifyGitignoredPaths` HIGH via `commitLaneWorktree` — mitigated by re-export from `lane-dirty-check.mjs` (API unchanged).
- Modules: `lane-dirty-check-git.mjs` (298), `lane-dirty-check-commit.mjs` (361), shim (141).
