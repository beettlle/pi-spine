# SP-790: Refuse post-archive batch-state resurrection — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-09-28
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Done

- [x] Reproduce #293 (see Discoveries #1)
- [x] List + classify `bypassWriteGuard: true` sites (see Discoveries #2)
- [x] List tests pinning guard behavior (see Discoveries #3)
- [x] Dependencies satisfied (none declared)

### Step 1: Guard + bypass semantics + rejected-write journal
**Status:** ✅ Done

- [x] Resurrection rejected for every phase
- [x] Bypass = owner check only; `allowArchivedResurrection` at recovery sites
- [x] `batch.state_write_rejected` journaled
- [x] `isBatchArchived` exported

### Step 2: Late finalize + preflight suggestion
**Status:** ✅ Done

- [x] Late finalize skipped after archive
- [x] Preflight suggests `spine batch complete`

### Step 3: Tests
**Status:** ✅ Done

- [x] #293 regression test
- [x] Guard tests
- [x] Preflight test

### Step 4: Testing & Verification
**Status:** ✅ Done

- [x] Lint
- [x] Contract `testCommand`
- [x] Batch suite
- [x] Coverage gate
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Done

- [x] Bypass-site classification logged
- [x] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | #293 reproduced via `spine-tasks/SP-790-refuse-post-archive-state-resurrection/_repro.mjs`: after archive+remove, `evaluateBatchStateWriteGuard` returns `{allowed:true}` for an incoming `completed` phase, and `saveSpineBatchState(..., {bypassWriteGuard:true})` recreates `.spine/batch-state.json` with phase `completed`. |
| 2 | `bypassWriteGuard: true` site classification (17 sites): **owner-bypass only** — `attached-runner-reconcile.mjs:232`, `attached-runner-promote.mjs:459`, `resume-gate-reopen.mjs:34`, `pause.mjs:88/186/201`, `resume-multi.mjs:77`, `parent-session-monitor.mjs:143`, `post-merge-limbo.mjs:171/244/269/378/401`, `detached-wait.mjs:182`, `attached-engine-handoff.mjs:123/148` (all write a live batch whose state file exists on disk — resurrection branch does not apply). **Intentional resurrection** — `batch-meta-reconstruct.mjs:385` only (force-resume rebuilds state from batch-meta when live state is missing/corrupt, #126) → gets `allowArchivedResurrection: true`. |
| 3 | Tests pinning guard/bypass behavior: `batch-state-stale-writer.test.mjs` (resurrection rejected for phase `running`; stale_engine_pid), `engine-liveness-starttime.test.mjs` (calls `evaluateBatchStateWriteGuard` directly, 2-arg form), `batch-state-lock.test.mjs:69`, `batch-state-handoff.test.mjs:89`, `sequence-detached-poll.test.mjs:163`, `pause-phase-persistence.test.mjs:107`, `pause-retry-guard.test.mjs:133` (all bypass writes on live batches — unaffected). |
| 4 | No import cycle: `journal.mjs` imports only node builtins + `journal-checksum.mjs` + `../util/secret-redact.mjs`; neither reaches `state-io.mjs`. Direct import of `appendJournalEvent` in `state-io.mjs` is safe. |
| 5 | GitNexus impact: `saveSpineBatchState` upstream blast radius is **CRITICAL** (47 direct callers / 30 processes) — expected, the guard sits under every state write. Semantic delta is narrow: new rejection only fires when the state file is absent AND the archive exists AND `allowArchivedResurrection` is unset; all 16 owner-bypass sites write live batches with the state file present (Discovery #2), so their behavior is unchanged. `ensureForceResumeBatchState` impact is LOW (2 callers). Mitigated by full contract suite in Step 4. |
| 6 | GitNexus impact: `finalizeBatchForIntegrate` is **HIGH** (3 direct callers: startBatch, tryFinalizePostMergeLimbo, finalizeResumedBatchForIntegrate). The added branch is an early return that fires only when the archive exists AND the live state file is absent — unreachable in normal flow since all callers operate on a live loaded state. `checkNoActiveBatch` is LOW (runBatchPreflight + tests). post-merge-limbo + preflight suites pass after the change. |
| 7 | First `coverage:check` run showed 44 failures — **operator error, not code**: run without `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER`, so worker-env guards correctly blocked nested batch spawns in subprocess-spawning tests. Re-run with clean env: matrix suite 2715/2715, line coverage 90.02% ≥ 77%, exit 0. PROMPT's `env -u` instruction exists exactly for this. |
| 8 | `detect_changes` (vs HEAD~3): all changed symbols confined to File Scope — `evaluateBatchStateWriteGuard`, `saveSpineBatchState`, `finalizeBatchForIntegrate`, `ensureForceResumeBatchState`, `checkNoActiveBatch` (+ same-file touches only). `.spine/rules-manifest.json` generatedAt drift from test runs was restored, not committed. |
## Blockers

_None._

## Verification Evidence

- `npm run lint` — clean (exit 0)
- `npm run typecheck` — clean (exit 0)
- Contract `testCommand` — 53/53 pass
- `npm run test:batch` (env -u worker vars) — 1555/1555 pass
- `npm run coverage:check` (env -u worker vars) — matrix suite 2715/2715, line coverage 90.02% ≥ 77%, exit 0
- `docs/adoption/operator-runbook.md` §4/§6 reviewed — not affected (operator flow unchanged; SP-803 owns v2.26.0 state docs)
