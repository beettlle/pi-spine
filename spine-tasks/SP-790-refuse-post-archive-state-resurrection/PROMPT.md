# Task: SP-790 — Refuse post-archive batch-state resurrection

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Every batch-state write goes through the guard; a wrong change can block legitimate engine saves or operator recovery (force-resume from batch-meta, salvage).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `finalizeBatchForIntegrate` (`src/batch/post-merge-limbo.mjs` ~358-401) saves state, then collects extended integrate-gate evidence for minutes, then saves again (via `ensureLandLoopFinalizedAfterGateOrIntegrate` ~line 171 and ~line 401), all with `bypassWriteGuard: true`. If the operator runs `spine gate approve && spine integrate && spine batch complete` while evidence is collecting, `batch complete` archives and removes `.spine/batch-state.json`, then the late save recreates it with phase `completed`. Even without the bypass, `evaluateBatchStateWriteGuard` (`src/batch/state-guards.mjs` ~44-79) only blocks resurrection for phases planning/running/paused. The next `spine batch start` fails preflight `no-active-batch` with a self-referential `spine preflight` suggestion.

## Mission

Closes #293 — Partial #301. A batch that has been archived is never recreated on disk by a late write, rejected writes are journaled, and preflight points the operator at the real fix.

1. **Guard, any phase** (`state-guards.mjs`): when `.spine/batch-state.json` is absent and `.spine/runtime/<batchId>/archive/batch-state.json` exists, reject the write for **every** incoming phase with reason `archived_batch_resurrection`. Export a small `isBatchArchived(projectRoot, batchId)` helper so callers can check without duplicating the path.
2. **Bypass skips only the owner check** (`state-io.mjs` `saveSpineBatchState`): `bypassWriteGuard: true` now skips only the live-foreign-owner-PID check; the resurrection check always runs. Add an explicit `allowArchivedResurrection: true` option for operator-initiated recovery that intentionally rebuilds an archived batch (at minimum `src/batch/batch-meta-reconstruct.mjs` ~line 385, force-resume from batch-meta #126). Audit every `bypassWriteGuard: true` site (`rg -n "bypassWriteGuard: true" src`) and pass `allowArchivedResurrection` **only** where the site is an explicit operator recovery that must recreate archived state; record the classification of each site in STATUS.md Discoveries.
3. **Rejected writes are visible**: when the guard rejects, append journal event `batch.state_write_rejected` with `{ reason, incomingPhase }` (batchId from the incoming state) and print one `[spine]` line to stderr. Keep the existing return value (on-disk state or incoming state) so current callers are unaffected — the structured `{ ok, reason }` result arrives with `updateSpineBatchState` in SP-791. Check for an import cycle between `state-io.mjs` and `journal.mjs` before importing; if one exists, inject the journal writer instead.
4. **Late finalize no-ops after archive** (`post-merge-limbo.mjs`): in `finalizeBatchForIntegrate`, after `openIntegrateGateAfterBatchComplete` returns, if `isBatchArchived(projectRoot, batchId)` and the active state file is absent, skip `ensureLandLoopFinalizedAfterGateOrIntegrate` and the final save, and journal `batch.late_finalize_skipped` `{ batchId, reason: "archived" }` instead of `batch.land_loop_finalized`.
5. **Preflight suggestion** (`src/config/preflight/git-batch.mjs` `checkNoActiveBatch`): when the active state is phase `completed` and its archive exists (or its gate/integrate already completed), `suggestedCommand` is `spine batch complete`, never `spine preflight`.

## Dependencies

- **None**

## Context to Read First

- GitHub #293 (journal excerpt + repro) and #301 (proposed solution steps 5 and 6)
- `src/batch/state-guards.mjs` — `evaluateBatchStateWriteGuard`, `archivedBatchStatePath`
- `src/batch/state-io.mjs` — `saveSpineBatchState`
- `src/batch/post-merge-limbo.mjs` — `finalizeBatchForIntegrate` (~358), `ensureLandLoopFinalizedAfterGateOrIntegrate` (~100-181)
- `src/batch/batch-meta-reconstruct.mjs` ~385 — intentional resurrection (#126)
- `src/config/preflight/git-batch.mjs` — `checkNoActiveBatch` (~226)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/state-guards.mjs`
- `src/batch/state-io.mjs`
- `src/batch/post-merge-limbo.mjs`
- `src/batch/batch-meta-reconstruct.mjs`
- `src/config/preflight/git-batch.mjs`
- `tests/batch/late-finalize-after-complete.test.mjs`
- `tests/batch/batch-state-stale-writer.test.mjs`
- `tests/spine-preflight.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/late-finalize-after-complete.test.mjs tests/batch/batch-state-stale-writer.test.mjs tests/batch/batch-state-lock.test.mjs tests/batch/batch-state-handoff.test.mjs tests/batch/post-merge-limbo.test.mjs tests/batch/pause-phase-persistence.test.mjs tests/spine-preflight.test.mjs` |
| fileScopeMustChange | `src/batch/state-guards.mjs`, `src/batch/post-merge-limbo.mjs`, `tests/batch/late-finalize-after-complete.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reproduce #293 in a temp project: archive a batch (as `completeBatch` does), then call the late save path; confirm `.spine/batch-state.json` is recreated
- [ ] `rg -n "bypassWriteGuard: true" src` — list all sites; classify each as owner-bypass only vs. intentional resurrection
- [ ] `rg -n "archived_batch_resurrection|bypassWriteGuard" tests` — list tests that pin current guard behavior
- [ ] Dependencies satisfied

### Step 1: Guard + bypass semantics + rejected-write journal

- [ ] Resurrection rejected for every phase when state file absent and archive exists
- [ ] `bypassWriteGuard` skips only the owner-PID check; `allowArchivedResurrection` added and used only at intentional recovery sites
- [ ] `batch.state_write_rejected` journaled + stderr line; return value unchanged
- [ ] `isBatchArchived` exported from `state-guards.mjs`

**Artifacts:**
- `src/batch/state-guards.mjs`, `src/batch/state-io.mjs`, `src/batch/batch-meta-reconstruct.mjs` (modified)

### Step 2: Late finalize + preflight suggestion

- [ ] `finalizeBatchForIntegrate` skips post-evidence finalize/save when archived; journals `batch.late_finalize_skipped`
- [ ] `checkNoActiveBatch` suggests `spine batch complete` for a completed, archived batch

**Artifacts:**
- `src/batch/post-merge-limbo.mjs`, `src/config/preflight/git-batch.mjs` (modified)

### Step 3: Tests

- [ ] New `tests/batch/late-finalize-after-complete.test.mjs`: #293 regression — archive, then run the late finalize path; assert no state file, `batch.late_finalize_skipped` journaled, no `batch.land_loop_finalized` after archive
- [ ] Guard: `completed` / `failed` write after archive rejected and journaled; `allowArchivedResurrection` still allowed; normal new-batch write allowed
- [ ] Preflight: completed + archived → `suggestedCommand === "spine batch complete"`

**Artifacts:**
- `tests/batch/late-finalize-after-complete.test.mjs` (new), `tests/batch/batch-state-stale-writer.test.mjs`, `tests/spine-preflight.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Bypass-site classification table logged in STATUS.md Discoveries
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803 documents the v2.26.0 state/lock behavior)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §4 Land loop, §6 Resume, dismiss, complete

## Completion Criteria

- [ ] Late `land_loop_finalized` after `batch complete` no longer recreates `.spine/batch-state.json`
- [ ] Guard rejects post-archive writes for every phase unless `allowArchivedResurrection`
- [ ] Rejected writes journaled as `batch.state_write_rejected`
- [ ] Preflight suggests `spine batch complete` for a completed archived batch
- [ ] Closes #293

## Git Commit Convention

- `fix(SP-790): refuse post-archive batch-state resurrection (#293)`

## Do NOT

- Add `updateSpineBatchState` or migrate pause/abort/lifecycle callers (SP-791, SP-792)
- Rename `bypassWriteGuard` (SP-793 renames and audits call sites)
- Change lock acquisition or `writeJsonAtomic` (#302 — SP-794, SP-795)
- Change `spine wait` / `status` readiness semantics
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
