# SP-657: Post-DONE orphan auto-heal — Status

**Current Step:** Step 1 — Auto-heal before merge_blocked
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Reproduce .DONE + dead worker/engine → merge_blocked today
- [x] Inventory skippedDoneOnDisk sites

### Step 1: Auto-heal before merge_blocked
**Status:** 🔄 In Progress
- [x] Heal via skip-done path before failed merge_blocked
- [x] Reuse skippedDoneOnDisk / resume-multi semantics
- [x] Add post-DONE orphan heal fixture

### Step 2: Testing & Verification
**Status:** ⬜ Not Started
- [ ] Run contract testCommand
- [ ] Fix scoped failures
- [ ] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started
- [ ] Create `.DONE`
- [ ] Do not close #205

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Today `reconcileOrphanRunningState` always marks orphaned running tasks `failed` (`worker_orphaned`/`engine_orphaned`); retry then lands them in merge_blocked failed set | Auto-heal those tasks to `succeeded` with `skippedDoneOnDisk` when `laneDoneMarkerReadyForPromote` before failing |
| `skippedDoneOnDisk` emitters: `resume-multi-lanes.mjs` (markTaskCompleteFromDisk), `journal-rebuild-drift.mjs` (done_in_lane_terminal), `attached-runner-reconcile.mjs` (paused-resume promote) | Reuse attached-runner/resume journal shape (`skippedDoneOnDisk: true`, `reconciled: true`) inside reconcile-orphan — no new heal mechanism |
| Drift heal in reconcileBatch needs journal terminal artifacts; post-DONE orphan often lacks them (finalize never ran) | Gate on `laneDoneMarkerReadyForPromote` (committed lane `.DONE` / fail-closed), same promote gate as resume/attached |
| Real-pi session: plan review nested spawn skipped by design | Proceed after Step 0; engine reviews after `.DONE` |

## Completion Criteria

- [x] Post-DONE orphan not in merge_blocked failed set when evidence present
- [x] Reuses skip-done semantics
- [ ] Scoped tests green

## Blockers

_None._
