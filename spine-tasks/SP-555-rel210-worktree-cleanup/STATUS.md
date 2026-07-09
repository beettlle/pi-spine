# SP-555: worktree cleanup — Status

**Current Step:** Step 4
**Status:** ✅ Complete
**Last Updated:** 2026-07-09
**Review Level:** 2
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #169 reproduction steps
- [x] Trace abort vs dismiss vs complete cleanup paths

### Step 1: Abort + empty shell cleanup
**Status:** ✅ Complete

- [x] Wire `removeLaneWorktrees` on hard abort when config allows
- [x] Remove empty `.worktrees/spine-<batchId>/` after lane removal
- [x] Journal `batch.worktrees_cleaned` on abort path

### Step 2: Optional cleanup CLI
**Status:** ✅ Complete

- [x] `spine cleanup worktrees --dry-run` lists stale dirs/worktrees
- [x] `--yes` prunes empty shells and calls `git worktree prune`

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run contract `testCommand` (7/7 pass)
- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (1843 pass, 45 fail — pre-existing worker-env / CONTEXT.md drift, unrelated to SP-555)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Update operator runbook worktree section
- [x] Comment on #169
- [ ] Create `.DONE`
