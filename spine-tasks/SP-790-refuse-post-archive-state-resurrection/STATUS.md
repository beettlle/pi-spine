# SP-790: Refuse post-archive batch-state resurrection — Status

**Current Step:** Step 2
**Status:** 🟨 In Progress
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
**Status:** ⬜ Not Started

- [ ] Late finalize skipped after archive
- [ ] Preflight suggests `spine batch complete`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] #293 regression test
- [ ] Guard tests
- [ ] Preflight test

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Bypass-site classification logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | #293 reproduced via `spine-tasks/SP-790-refuse-post-archive-state-resurrection/_repro.mjs`: after archive+remove, `evaluateBatchStateWriteGuard` returns `{allowed:true}` for an incoming `completed` phase, and `saveSpineBatchState(..., {bypassWriteGuard:true})` recreates `.spine/batch-state.json` with phase `completed`. |
| 2 | `bypassWriteGuard: true` site classification (17 sites): **owner-bypass only** — `attached-runner-reconcile.mjs:232`, `attached-runner-promote.mjs:459`, `resume-gate-reopen.mjs:34`, `pause.mjs:88/186/201`, `resume-multi.mjs:77`, `parent-session-monitor.mjs:143`, `post-merge-limbo.mjs:171/244/269/378/401`, `detached-wait.mjs:182`, `attached-engine-handoff.mjs:123/148` (all write a live batch whose state file exists on disk — resurrection branch does not apply). **Intentional resurrection** — `batch-meta-reconstruct.mjs:385` only (force-resume rebuilds state from batch-meta when live state is missing/corrupt, #126) → gets `allowArchivedResurrection: true`. |
| 3 | Tests pinning guard/bypass behavior: `batch-state-stale-writer.test.mjs` (resurrection rejected for phase `running`; stale_engine_pid), `engine-liveness-starttime.test.mjs` (calls `evaluateBatchStateWriteGuard` directly, 2-arg form), `batch-state-lock.test.mjs:69`, `batch-state-handoff.test.mjs:89`, `sequence-detached-poll.test.mjs:163`, `pause-phase-persistence.test.mjs:107`, `pause-retry-guard.test.mjs:133` (all bypass writes on live batches — unaffected). |
| 4 | No import cycle: `journal.mjs` imports only node builtins + `journal-checksum.mjs` + `../util/secret-redact.mjs`; neither reaches `state-io.mjs`. Direct import of `appendJournalEvent` in `state-io.mjs` is safe. |
| 5 | GitNexus impact: `saveSpineBatchState` upstream blast radius is **CRITICAL** (47 direct callers / 30 processes) — expected, the guard sits under every state write. Semantic delta is narrow: new rejection only fires when the state file is absent AND the archive exists AND `allowArchivedResurrection` is unset; all 16 owner-bypass sites write live batches with the state file present (Discovery #2), so their behavior is unchanged. `ensureForceResumeBatchState` impact is LOW (2 callers). Mitigated by full contract suite in Step 4. |
## Blockers

_None._
