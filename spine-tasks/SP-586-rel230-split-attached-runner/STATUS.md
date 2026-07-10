# SP-586: Split attached-runner.mjs — Status

**Current Step:** Step 2
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-10
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read explore findings for attached-runner.mjs
- [x] List public exports to preserve

### Step 1: Extract attached-runner-promote.mjs
**Status:** ✅ Complete

- [x] Create module ≤500 LOC
- [x] Re-export from attached-runner.mjs

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] `node --test tests/batch/attached-batch-exit.test.mjs`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Create `.DONE`

## Notes

- Phase 65 v2.3.0 module split (SP-REL230)
- Explore: `spine-tasks/_explore/batch-module-split-v23/findings.md` — attached-runner.mjs 647 LOC; first half → promote, second half → reconcile (SP-604)
- Do not edit `bin/spine-cli/verify.mjs` (grandfather / SP-593)

## Discoveries

| Finding | Action |
|---------|--------|
| Public exports to preserve (API unchanged) | `DEFAULT_ATTACHED_MILESTONE_POLL_MS`, `ATTACHED_LAND_LOOP_MILESTONE_TYPES`, `installAttachedExitFinalizeHandlers`, `formatAttachedMilestoneLine`, `startAttachedMilestoneReporter`, `resumeHandoffLockPath`, `tryAcquireResumeHandoffLock`, `releaseResumeHandoffLock`, `enforceAttachedEngineSingleOwner`, `reconcilePausedResumeDoneInLane`, `runAttachedBatchEngine`, `formatAttachedBatchCliResult`, `finishAttachedBatchCli`, `finalizeResumePostMergeLimbo` |
| Promote/exit → `attached-runner-promote.mjs` | milestones, exit handlers, reporter, `runAttachedBatchEngine`, CLI format/finish, post-merge limbo finalize |
| Leave for SP-604 | lock helpers, `enforceAttachedEngineSingleOwner`, `reconcilePausedResumeDoneInLane` |
| Cycle avoidance | Define reconcile exports in `attached-runner.mjs` before re-exporting promote; promote imports reconcile helpers at call time |

## Plan (Review Level 1)

1. Create `src/batch/attached-runner-promote.mjs` with promote/exit paths (≤500 LOC).
2. Slim `attached-runner.mjs` to reconcile/lock + re-exports from promote (behavior unchanged).
3. Run contract test + typecheck + full stub suite; create `.DONE`.
