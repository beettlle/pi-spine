# SP-796: Shrink terminal lock sections to state I/O — Status

**Current Step:** Step 3 (Tests)
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-02
**Review Level:** 2
**Review Counter:** 1
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Lock-section operations classified
- [x] SP-792 landed (`reloadStateForTerminalWrite` present in abort.mjs + lifecycle.mjs, integrated in v2.26.0 wave 2)
- [x] Dependencies satisfied

### Step 1: Abort split
**Status:** ✅ Complete

- [x] State I/O only under lock
- [x] Cleanup after release

### Step 2: Complete + dismiss split
**Status:** ✅ Complete

- [x] Cleanup after release
- [x] Warnings + `batch.cleanup_failed`
- [x] `lifecycle.mjs` ≤ 500 lines

### Step 3: Tests
**Status:** 🟡 In Progress

- [ ] Lock not held during cleanup
- [ ] Cleanup failure reported

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
| 1 | Lock-section classification — `abortBatch` in-lock: reload (keep), buildAbortedSnapshot (pure, keep), writeAbortSignal (state I/O per SP-722/#264, keep), killLaneWorkers (MOVE), writeBatchArchive (keep), journal read + `batch.aborted` event (keep), journal-missing check (keep), appendBatchHistoryEntry (keep), loadSpineConfig + removeLaneWorktrees + `batch.worktrees_cleaned` (MOVE), clearActiveBatchState (keep). `dismissBatch` in-lock: reload, archive, postMortem (MOVE), history (keep), `batch.dismissed` (keep), metrics (MOVE), worktree cleanup (MOVE), clear (keep), dashboard bump (cheap signal write, keep). `completeBatch`: same minus dashboard bump, event `batch.completed`. Dismiss/complete lane-worker kill is already pre-lock (since SP-792) and stays. |
| 2 | `writeBatchPostMortem` returns the deterministic rel path `postMortemRelPath(batchId)` (postmortem.mjs:296), so the in-lock history entry can carry `postMortemPath` while the file is written post-release — `postmortem.test.mjs:124` asserts history.postMortemPath stays intact. |
| 3 | `appendJournalEvent` does not take the batch-state lock and uses `fs.appendFileSync` (journal-checksum.mjs appendJsonlLineSync) — safe post-release, and patchable as a lock-presence test hook. `fs.writeFileSync`/`fs.rmdirSync`/`process.kill` are the other synchronous hooks for lock-presence assertions (same monkey-patch technique as existing `serveStaleStateOnFirstRead`). |
| 4 | Callers of the three functions (bin/spine-batch.mjs, src/cli/batch-complete.mjs, src/batch/sequence-wait.mjs) consume `ok`/`exitCode`/`headline` only — additive `cleanupWarnings` is safe. GitNexus impact: LOW risk (0 indexed upstream callers). |
| 5 | Plan: new `src/batch/lifecycle-cleanup.mjs` exports generic `runPostReleaseCleanup({projectRoot, batchId, steps})` (per-step try/catch → `cleanupWarnings[]` + `batch.cleanup_failed {step, error}` journal event, never throws) and `runLifecycleCleanupAfterRelease(...)` building the shared post-mortem/metrics/worktrees steps for dismiss+complete; abort imports the generic runner for kill_lane_workers + remove_worktrees steps. lifecycle.mjs shrinks (494 → ~460 lines). |

## Blockers

_None._
