# SP-784: Integrate checkout sync safety — Status

**Current Step:** Step 1 (Safe sync in integrate)
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-782 on main (`tests/batch/integrate-base-cas.test.mjs` exists; `mergeOrchIntoBaseViaRefs` absent from src/ and tests/)
- [x] Reproduce both checkout effects (scratch repo, both confirmed on current code — see Discoveries)
- [x] Record LOC baselines (integrate.mjs 437, integrate-worktree.mjs 457, salvage-batch-integrate.mjs 490 — all ≤ 500)
- [x] Dependencies satisfied

### Implementation plan (Review Level 2)

1. `integrate-worktree.mjs`: import `listIntegrateDirtyPaths` (cycle check passed); inside `syncPlumbingMergePathsToWorktree`, intersect diff paths with the dirty set once, skip + record dirty paths, return `skippedDirtyPaths`, fix docstring. Add two small exported helpers used by both callers for parity: `syncMergePathsToCheckedOutBase` (gate: sync only when base checked out **now**, returns null otherwise) and `reportDirtyOverlap` (journals `integrate.dirty_overlap`, returns the `DirtyOverlap` warning string or null).
2. `integrate.mjs`: route fast-forward + plumbing sync through the gate wrapper; delete the dead `checkout` + `reset --hard` bare-catch block; attach `warnings: [DirtyOverlap …]` to the success result when non-empty. Keep `baseCheckedOutAtStart` (still read by the `integrate.completed` journal payload).
3. `salvage-batch-integrate.mjs`: same gate wrapper for the plumbing sync; overlap report + `warnings` on success result. LOC headroom is tight (490/500) — keep diff minimal.
4. Tests: extend feature-branch test with porcelain equality; new base-checked-out + dirty-path test (edit preserved, warning + journal event); unit test for `skippedDirtyPaths` in integrate-worktree-sync; salvage assertion.

> Note: real-pi session — engine runs plan/code review after .DONE (SP-195).

### Step 1: Safe sync in integrate
**Status:** ⬜ Not Started

- [ ] Sync gated on base checked out now
- [ ] Dirty skip + `skippedDirtyPaths` + docstring
- [ ] `integrate.dirty_overlap` + warning
- [ ] Dead code removed

### Step 2: Salvage parity
**Status:** ⬜ Not Started

- [ ] Same gate + dirty skip

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Feature-branch porcelain unchanged
- [ ] Dirty edit preserved + reported
- [ ] Salvage assertion

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Integrate + salvage tests
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

_None yet._

## Blockers

_None._
