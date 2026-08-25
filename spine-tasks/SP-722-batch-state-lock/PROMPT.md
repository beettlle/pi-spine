# Task: SP-722 — Global inter-process lock for batch-state writers

**Created:** 2026-08-25
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Cross-process locking on hot state paths; reliability + correctness.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 1

## Mission

Closes #264 — Add `withBatchStateLock(projectRoot, fn)` and wrap all batch-state RMW paths (`saveSpineBatchState`, `appendBatchHistoryEntry`, abort signal writes). Unify or document resume handoff lock vs global lock. Concurrent complete+resume must not lose updates.

## Dependencies

- **None**

## Context to Read First

- `src/batch/state-io.mjs` — saveSpineBatchState / appendBatchHistoryEntry
- `src/batch/attached-runner-reconcile.mjs` — tryAcquireResumeHandoffLock
- GitHub #264, #261

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/batch-state-lock.mjs`
- `src/batch/state-io.mjs`
- `src/batch/abort.mjs`
- `src/batch/lifecycle.mjs`
- `tests/batch/batch-state-lock.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-state-lock.test.mjs` |
| fileScopeMustChange | `src/batch/batch-state-lock.mjs`, `tests/batch/batch-state-lock.test.mjs` |

## Steps

### Step 1: withBatchStateLock helper

- [ ] Add `src/batch/batch-state-lock.mjs` with exclusive lock (wx or flock) under `.spine/runtime/`
- [ ] Document lock ordering: state before history; no nested lock from same process

### Step 2: Wrap writers

- [ ] Wrap `saveSpineBatchState` and `appendBatchHistoryEntry` under the lock
- [ ] Wrap abort / lifecycle writers that touch batch-state or history
- [ ] Document resume handoff lock relationship (unified or subset)

### Step 3: Concurrent tests

- [ ] Add `tests/batch/batch-state-lock.test.mjs` — concurrent writers, no lost updates
- [ ] Keep existing resume/concurrent suites green when run in Testing step

### Step 4: Testing & Verification

- [ ] Run contract `testCommand` only
- [ ] Fix all failures from the scoped contract command

### Step 5: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — only if operator-facing lock semantics change

## Completion Criteria

- [ ] All batch-state RMW paths acquire shared lock
- [ ] Concurrent test proves no lost updates
- [ ] Closes #264
- [ ] `.DONE` created

## Do NOT

- Distributed/multi-machine locking
- Journal append lock redesign
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus (#149)

## Git Commit Convention

- `fix(SP-722): global inter-process lock for batch-state writers (#264)`
