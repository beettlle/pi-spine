# SP-793: bypassOwnerCheck rename and bypass-site audit — Status

**Current Step:** Step 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

### Step 0: Preflight
**Status:** ✅ Done

- [x] SP-790 + SP-791 landed (commit c129ac4a; `allowArchivedResurrection` + `updateSpineBatchState` present in `state-io.mjs`)
- [x] Before count recorded — `bypassWriteGuard`: **17 call sites** in src (24 raw occurrences incl. 7 docstrings) + 14 in tests, 18 files
- [x] Dependencies satisfied

### Step 1: Rename
**Status:** ✅ Done

- [x] `bypassOwnerCheck`, no alias (`state-io.mjs` maps it to guard-internal `skipOwnerCheck`; no `bypassWriteGuard` alias kept)
- [x] All references updated — `rg bypassWriteGuard src tests docs` → 0 matches (17 src call sites + 7 JSDoc refs + 14 test refs renamed); targeted test run 17/17 green

### Step 2: Reduce + migrate
**Status:** ✅ Done

> One checkbox per bypass site found in Step 0 (17 sites) — before/after count: **17 → 15**

- [x] `resume-gate-reopen.mjs:34` → `updateSpineBatchState`, bypass dropped (operator CLI on completed batch; no live owner)
- [x] `parent-session-monitor.mjs:143` → `updateSpineBatchState`, bypass dropped (dead-owner write; monitor process is never the recorded owner)
- [x] `batch-meta-reconstruct.mjs:388` → keep `bypassOwnerCheck` + `allowArchivedResurrection` (intentional recovery rebuild, #126)
- [x] `attached-engine-handoff.mjs:123` → keep `bypassOwnerCheck` (engine clears own PID after in-process finalize)
- [x] `attached-engine-handoff.mjs:148` → keep `bypassOwnerCheck` (detached child records new PID)
- [x] `post-merge-limbo.mjs:172` → keep `bypassOwnerCheck` (land-loop finalize: engine clears PID, marks completed)
- [x] `post-merge-limbo.mjs:245` → keep `bypassOwnerCheck` (attached-exit finalize: engine clears PID)
- [x] `post-merge-limbo.mjs:270` → keep `bypassOwnerCheck` (records spawned resume engine PID)
- [x] `post-merge-limbo.mjs:379` → keep `bypassOwnerCheck` (persist PID clear before evidence can hang, #198/SP-636)
- [x] `post-merge-limbo.mjs:431` → keep `bypassOwnerCheck` (always persist phase/PID after gate ensure)
- [x] `attached-runner-reconcile.mjs:232` → keep `bypassOwnerCheck` (terminate-stale-then-save PID hand-off, `--force`)
- [x] `attached-runner-promote.mjs:459` → keep `bypassOwnerCheck` (terminate-stale-then-save PID hand-off, resume fast path)
- [x] `resume-multi.mjs:77` → keep `bypassOwnerCheck` (terminate-stale-then-save PID hand-off, post-merge-limbo resume)
- [x] `detached-wait.mjs:182` → keep `bypassOwnerCheck` (orphan resume hand-off before spawning resume engine)
- [x] `pause.mjs:113` → keep `bypassOwnerCheck` (engine re-asserts operator pause; writer may not be recorded owner after hand-off)
- [x] `pause.mjs:223` → keep `bypassOwnerCheck` (operator pause while live attached engine owns batch — sanctioned SP-376 exception)
- [x] `pause.mjs:262` → keep `bypassOwnerCheck` (operator pause rollback of unconfirmed pause)
- [x] Gate reopen via helper (`resume-gate-reopen.mjs` uses `updateSpineBatchState`) — reopen decision + persist now one locked read-modify-write; targeted tests 23/23 green (attached-parent-died, resume-multi-engine, gate-target-revision-validate)

### Step 3: Justify + tests
**Status:** ⬜ Not Started

- [ ] Before/after table
- [ ] Gate-reopen concurrent-pause test

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Before count: `rg bypassWriteGuard src` = 24 raw occurrences = **17 call sites** + 7 doc/JSDoc references (`state-io.mjs` ×6, `pause.mjs` ×1); tests = 14 occurrences across 8 files. Matches the 17 sites counted in #301 / SP-790 Discovery #2. |
| 2 | `reopenIntegrateGateForCompletedBatch` never mutates the passed `batchState` — gate state lives in the separate gate record file. The old `saveSpineBatchState(reopenState, { bypassWriteGuard: true })` re-persisted an unmutated snapshot (updatedAt bump). Migration to `updateSpineBatchState` (reopen inside the mutate callback, fresh locked read) is behavior-preserving. |
| 3 | Guard semantics check (`state-guards.mjs`): owner check rejects only when on-disk `enginePid` ≠ `process.pid` AND alive. Completed batches have PID cleared on terminal save → gate reopen never needs an owner bypass. Parent-session monitor: recorded owner is the dead parent engine → guard allows without bypass; if ownership was handed to a live detached child, rejection (loud, SP-790) is the correct outcome vs. old bypass clobber. |
| 4 | No `bypassWriteGuard` references in `docs/` — operator-runbook Check-If-Affected is a no-op. |

## Blockers

_None._
