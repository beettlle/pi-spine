# SP-660: Single resume owner — Status

**Current Step:** Step 3 — Documentation & Delivery
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-13
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete
- [x] Read SP-533 concurrent lock gaps
- [x] Trace resume_handoff_started for detached vs attached

### Step 1: Fail-fast second resume
**Status:** ✅ Complete
- [x] Fail-fast while lock/engine owns batch
- [x] Clear operator error; no dual engines
- [x] Add paired detached/attached tests

### Step 2: Testing & Verification
**Status:** ✅ Complete
- [x] Run contract testCommand
- [x] Fix scoped failures
- [x] Coverage gate (≥77%)

### Step 3: Documentation & Delivery
**Status:** 🟡 In Progress
- [ ] Create `.DONE`
- [ ] Close #207 when criteria met

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| `batch.resume_handoff_started` journals only inside `enforceAttachedEngineSingleOwner` when `force && operation==="resume"` (`attached-runner-reconcile.mjs`). Both `resumeBatch` and `resumeBatchDetached` call it → paired detached+attached journal events for one operator resume. | Detached child with recorded `enginePid === process.pid` skips re-handoff journal; parent persists PID before unlock and holds lock across wait. |
| SP-533 covers lock-held concurrency but not live-engine ownership after handoff unlock / across detached→attached pairing. | Fail-fast when live `enginePid` owns `running`/`gating`; preserve paused/failed force orphan. |
| Real logic lives in `attached-runner-reconcile.mjs` / `detached-run.mjs` (facades re-export). | Edited reconcile + detached-run; touched facades/comments for File Scope. |
| GitNexus impact: CRITICAL on `enforceAttachedEngineSingleOwner` | Narrow phase-gated change; paused orphan path preserved. |
| `npm run coverage:check` inside worker inherits `SPINE_IS_WORKER=1` and false-fails 43 suite tests | Re-ran with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER`; line coverage 89.15%. |

## Completion Criteria

- [x] Single resume owner fail-fast
- [ ] #207 closable
- [x] Scoped tests green

## Blockers

_None._

## Notes (Plan — Review Level 1)

Implemented per plan. Contract: 12/12 green. Coverage: 89.15% (≥77%).
