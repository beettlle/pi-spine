# Task: SP-792 — Abort, complete and dismiss archive the state read inside the lock

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Terminal land-loop operations (abort, complete, dismiss); a regression can archive the wrong snapshot or fail to clear state.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** `abortBatch` (`src/batch/abort.mjs` ~149) reads `loaded` outside the lock; inside the lock (~226-227) `buildAbortedSnapshot(loaded.raw, …)` archives that stale snapshot, so engine progress saved between the read and the lock is lost from the archive. `dismissBatch` (`src/batch/lifecycle.mjs` ~213) and `completeBatch` (~419) do the same: `archiveBatchState(projectRoot, batchId, loaded.raw)` uses a pre-lock read.

## Mission

Partial #301 — Abort, complete and dismiss re-read batch state inside the lock and build archives from that in-lock state.

1. **Abort** (`abort.mjs`): inside the `withBatchStateLock` section, reload the state (same path resolution as the outer read). If the batch id changed or the file vanished, return a clear non-ok result (`headline: "Batch state changed during abort — re-run spine status --diagnose"`) instead of archiving. Build the aborted snapshot from the in-lock state.
2. **Dismiss and complete** (`lifecycle.mjs`): same pattern — reload inside the lock; verify `batchId` still matches; archive, write history and clear from the in-lock state. Keep all pre-lock validation (phase checks, supervisor termination) as-is, but re-validate the terminal-phase precondition on the in-lock state.
3. **Keep the lock sections' current contents** otherwise — moving worker termination and worktree cleanup out of the lock is SP-796 (#302). This task only changes *which* snapshot is used.
4. **Tests**: stale-snapshot case in `tests/batch/abort.test.mjs` (write a newer state between the outer read and the lock — e.g. via an injected hook or by calling the inner function with a stale `loaded` — and assert the archive holds the newer state); equivalent cases for complete and dismiss in `tests/batch/lifecycle.test.mjs`; batch-id-changed case returns non-ok and archives nothing.

## Dependencies

- **None**

## Context to Read First

- GitHub #301 (proposed solution step 4)
- `src/batch/abort.mjs` — `abortBatch` (~148), lock section (~226-300), `buildAbortedSnapshot` (~108)
- `src/batch/lifecycle.mjs` — `dismissBatch` (~114, lock ~213), `completeBatch` (~273, lock ~419)
- `src/batch/lifecycle-archive.mjs` — `archiveBatchState`, `clearCompletedBatchState`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/abort.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/abort.test.mjs`
- `tests/batch/lifecycle.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/abort.test.mjs tests/batch/lifecycle.test.mjs tests/batch/batch-state-handoff.test.mjs tests/batch/batch-state-lock.test.mjs` |
| fileScopeMustChange | `src/batch/abort.mjs`, `src/batch/lifecycle.mjs`, `tests/batch/abort.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `rg -n "loaded\.raw" src/batch/abort.mjs src/batch/lifecycle.mjs` — list every use of the pre-lock snapshot inside lock sections
- [ ] Note current line counts (`lifecycle.mjs` 469; cap 500)
- [ ] Dependencies satisfied

### Step 1: Abort in-lock reload

- [ ] Reload inside lock; batch-id / missing-file mismatch returns non-ok
- [ ] Snapshot built from in-lock state

**Artifacts:**
- `src/batch/abort.mjs` (modified)

### Step 2: Complete + dismiss in-lock reload

- [ ] Reload inside lock; terminal precondition re-validated
- [ ] Archive/history/clear use in-lock state
- [ ] `lifecycle.mjs` stays ≤ 500 lines (extract a shared `reloadStateForTerminalWrite` helper into `lifecycle-archive.mjs` only if needed to stay under the cap — then add that file to STATUS Discoveries)

**Artifacts:**
- `src/batch/lifecycle.mjs` (modified)

### Step 3: Tests

- [ ] Abort archives the newer in-lock state
- [ ] Complete and dismiss archive the newer in-lock state
- [ ] Batch-id-changed → non-ok, nothing archived

**Artifacts:**
- `tests/batch/abort.test.mjs`, `tests/batch/lifecycle.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §6 Resume, dismiss, complete

## Completion Criteria

- [ ] Abort, complete and dismiss archive the state as read inside the lock
- [ ] Batch-id change during the operation fails closed

## Git Commit Convention

- `fix(SP-792): archive in-lock batch state on abort/complete/dismiss (#301)`

## Do NOT

- Move worker kill, post-mortem or worktree cleanup outside the lock (SP-796)
- Rename `bypassWriteGuard` (SP-793)
- Change `pause.mjs` or `state-io.mjs` (SP-791)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-09-28: Contract `testCommand` sets `SPINE_SUPPRESS_JOURNAL_ATTACH=1` so tests run by the worker cannot write into the live batch journal (#328).
