# SP-830: Integrate removes branch-deleted paths — Status

**Current Step:** Step 0: Preflight
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-10-14
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Line count recorded
- [x] Dependencies satisfied

### Step 1: Deletion helper and opt-in
**Status:** ✅ Complete

- [x] `removeMergeDeletedPath`
- [x] `applyDeletions` branch
- [x] Integrate/salvage opt in

### Step 2: Tests
**Status:** ✅ Complete

- [x] Four cases

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Lint
- [x] Contract `testCommand`
- [x] Line limit
- [x] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Impact `syncPlumbingMergePathsToWorktree`: LOW risk, 2 direct callers (`syncMergePathsToCheckedOutBase` same file; `syncHumanCheckoutWithBase` in src/cli/sync-base.mjs — stays opt-out, no changes there). |
| 2 | Impact `syncMergeResultToCheckedOutBase`: HIGH risk — direct callers `integrateOrchToBase` (src/batch/integrate.mjs:349) and `integrateSalvageableLane` (src/batch/salvage-batch-integrate.mjs:354); flows runSequence/wave-land-loop affected. Both callers pass `{ dirtyPaths }` only, so forcing `applyDeletions: true` inside the wrapper opts integrate in without touching those files. |
| 3 | Line counts: integrate-worktree.mjs 498/500 (budget 2 net lines: +1 import, +1 deletion branch), test file 198, sync-base.mjs 354 (untouched). |
| 4 | Empirical git checks: `git rm --cached` succeeds after a CAS ref move (stale index vs new HEAD) and leaves the worktree file behind, so the helper rmSync's the leftover; `--cached` does NOT refuse on local modifications, so the helper runs `git diff --quiet` first and refuses removal when the worktree file differs from the index. |
| 5 | SP-828 landed (commits cd03cda1, e6f55569): sync primitives exist in tree. Dependencies satisfied. |
| 6 | Post-ref-move `git status --porcelain` shows merge-deleted paths as staged additions (`A `), so a live `listIntegrateDirtyPaths` scan flags them dirty. Deleted-path skip therefore keys on actual worktree-vs-index modification (helper's `git diff --quiet` guard): clean stale entry → removable (Contract case 1), edited/deleted file → `{ removed: false }` → loop reports `skippedDirtyPaths` (case 3). Gitlinks bypass the diff guard and keep their directory (case 2). |
| 7 | Line-limit juggling: deduped the two verbose timed-out result literals into `timeoutSyncResult` to fund the deletion branch; integrate-worktree.mjs is exactly 500 lines. |
| 8 | Stet contract run v1: 7 findings, all triaged and dismissed (no real defects). Reviewer bugs recorded: (a) claimed `git diff --quiet` exits 0 on operator deletion — actually exits 1 (verified); (b) two findings caused by partial-hunk context (import/option flagged unused while usage sits outside the hunk); (c) claimed `{...options}` throws on null/undefined — object spread of null/undefined is well-defined JS (verified); (d) predicted the FF test fails on dirty index — the helper's diff guard prevents it, test green (53/53, exit 0). |
| 9 | Contract testCommand evidence: `npm run lint` clean; `npm run typecheck` clean; 53 tests across 7 files exit 0 (worker env vars unset per Environment); stet re-run: 0 findings, exit 0. |

## Blockers

_None._
