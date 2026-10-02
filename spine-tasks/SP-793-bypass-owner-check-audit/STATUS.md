# SP-793: bypassOwnerCheck rename and bypass-site audit — Status

**Current Step:** Step 5
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
**Status:** ✅ Done

- [x] Before/after table in STATUS.md Discoveries — **17 → 15 bypass call sites** (see Discovery #5)
- [x] Gate-reopen concurrent-pause test — 2 new cases in `tests/batch/batch-state-update.test.mjs` (9/9 green)

### Step 4: Testing & Verification
**Status:** ✅ Done

- [x] Lint — `npm run lint` exit 0
- [x] Contract `testCommand` — 44/44 tests, exit 0
- [x] Batch suite — `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`: 1578/1578, exit 0
- [x] Coverage gate — `npm run coverage:check` (clean env): 2738/2738, line coverage **90.01% ≥ 77%**, exit 0
- [x] Fix all failures — none failed; GitNexus `detect_changes` confirms scope confined to File Scope; `.spine/rules-manifest.json` test-run drift restored, not committed

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
| 5 | **SP-793 bypass-site audit (#301): before → after = 17 → 15 call sites.** | file:line (before) | before | after | one-line reason |
|---|---|---|---|---|
| | `resume-gate-reopen.mjs:34` | `saveSpineBatchState(..., { bypassOwnerCheck })` | `updateSpineBatchState` (no bypass) | Operator CLI on a completed batch — no live owner exists; reopen decision + persist now one locked read |
| | `parent-session-monitor.mjs:143` | `saveSpineBatchState(..., { bypassOwnerCheck })` | `updateSpineBatchState` (no bypass) | Recorded owner is the dead parent engine — guard allows; live detached-child owner now correctly rejects instead of clobbering |
| | `batch-meta-reconstruct.mjs:388` | `bypassOwnerCheck + allowArchivedResurrection` | kept (both) | Intentional operator recovery rebuild from batch-meta (#126) — the one sanctioned resurrection |
| | `attached-engine-handoff.mjs:123` | `bypassOwnerCheck` | kept | Attached engine finalizes post-merge in-process and clears its own PID — engine hand-off write |
| | `attached-engine-handoff.mjs:148` | `bypassOwnerCheck` | kept | Records the spawned detached resume engine's new PID — PID hand-off write |
| | `post-merge-limbo.mjs:172` | `bypassOwnerCheck` | kept | Land-loop finalize: engine clears PID + marks completed (may follow PID hand-off) |
| | `post-merge-limbo.mjs:245` | `bypassOwnerCheck` | kept | Attached-exit finalize in-process: engine clears PID after finalize |
| | `post-merge-limbo.mjs:270` | `bypassOwnerCheck` | kept | Records spawned resume engine PID — PID hand-off write |
| | `post-merge-limbo.mjs:379` | `bypassOwnerCheck` | kept | Persists PID clear before evidence collection can hang (#198/SP-636) |
| | `post-merge-limbo.mjs:431` | `bypassOwnerCheck` | kept | Always persists phase/PID after gate-ensure no-op — engine finalize write |
| | `attached-runner-reconcile.mjs:232` | `bypassOwnerCheck` | kept | `resume --attached --force` terminates live orphan then persists cleared-PID state — SIGKILL-reap race makes guard bypass necessary for the hand-off |
| | `attached-runner-promote.mjs:459` | `bypassOwnerCheck` | kept | Resume fast path: terminate-stale-then-save PID hand-off |
| | `resume-multi.mjs:77` | `bypassOwnerCheck` | kept | Post-merge-limbo resume: terminate-stale-then-save PID hand-off |
| | `detached-wait.mjs:182` | `bypassOwnerCheck` | kept | Orphan-resume hand-off immediately before spawning the resume engine |
| | `pause.mjs:113` | `bypassOwnerCheck` | kept | Engine re-asserts operator pause; writer may no longer be recorded owner after hand-off |
| | `pause.mjs:223` | `bypassOwnerCheck` | kept | Operator pause while a live attached engine owns the batch — the sanctioned SP-376 exception |
| | `pause.mjs:262` | `bypassOwnerCheck` | kept | Rollback of an unconfirmed pause under the same live-owner condition |
| 6 | Tests: renamed 14 `bypassWriteGuard` refs across 8 test files; added 2 SP-793 gate-reopen cases in `batch-state-update.test.mjs` — one proves the persist is refused (and journaled `batch.state_write_rejected`) when a live foreign owner exists (pre-SP-793 bypass wrote anyway), the other proves a concurrent `phase: "paused"` survives the reopen (declined `batch_not_completed`, disk stays paused, no gate record opened). |

## Blockers

_None._
