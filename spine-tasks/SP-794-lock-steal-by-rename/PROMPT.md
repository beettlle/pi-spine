# Task: SP-794 — Batch-state lock: steal stale locks by rename with token re-check

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** The global batch-state lock serializes every state writer; a mistake lets two processes into the critical section or deadlocks waiters.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** `breakStaleLock` (`src/batch/batch-state-lock.mjs` ~186-292) reads the holder (~190), decides it is stale, then `unlinkSync(lockPath)` (~216, 227, 247, 260, 286) with no token re-check. Two waiters can both judge a dead holder stale; waiter A unlinks and acquires; waiter B then unlinks A's fresh lock and acquires too — both run in the critical section. The `existsSync` at ~197 does not close the window, and the PID-recycled path spawns `ps` (~278), widening it. `releaseLockFile` (~300) is token-gated; breaking is not.

## Mission

Partial #302 — Breaking a stale lock can only remove the exact lock file that was judged stale.

1. **Steal by rename**: replace every `unlinkSync(lockPath)` in `breakStaleLock` with one helper `stealIfTokenMatches(lockPath, staleToken, reason)`:
   - `renameSync(lockPath, \`${lockPath}.break.${process.pid}.${random}\`)`; `ENOENT` → someone else already broke/released it, return.
   - Re-read the renamed file. If its token equals `staleToken` (the token read when judging), unlink the renamed file.
   - Otherwise a new holder acquired between judge and rename: put it back with `linkSync(renamed, lockPath)` (ignore `EEXIST` — a third process already acquired, which is also fine) and unlink the renamed path.
   - For the corrupt/invalid-payload branches (no token), compare full file content instead of the token.
2. **Keep all existing staleness rules** (corrupt ≥ 2 s old, invalid PID, same-process leak not held, dead foreign PID, recycled PID by starttime). Only the removal mechanism changes. Keep `logLockBreak` diagnostics.
3. **Tests** in `tests/batch/batch-state-lock.test.mjs`: two-concurrent-stealers test with child processes and a dead-holder fixture (lock file naming a dead PID) — each child tries to acquire, records entry/exit timestamps inside the critical section and holds briefly; assert no overlapping critical sections and exactly one acquisition at a time across ≥ 20 rounds. Unit test the put-back branch: judge stale, swap in a fresh lock with a different token before the rename, assert the fresh lock survives.

## Dependencies

- **None**

## Context to Read First

- GitHub #302 (defect 1 and proposed solution step 1)
- `src/batch/batch-state-lock.mjs` — header (lock ordering, re-entrancy), `tryCreateLockFile`, `breakStaleLock`, `releaseLockFile`
- `tests/batch/batch-state-lock.test.mjs` — existing single-breaker cases and child-process helpers

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/batch-state-lock.mjs`
- `tests/batch/batch-state-lock.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-state-lock.test.mjs tests/batch/batch-state-update.test.mjs tests/batch/batch-state-stale-writer.test.mjs` |
| fileScopeMustChange | `src/batch/batch-state-lock.mjs`, `tests/batch/batch-state-lock.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Map every unlink in `breakStaleLock` to its staleness rule
- [ ] Run the existing lock tests 3× to record baseline flake rate
- [ ] Dependencies satisfied

### Step 1: Steal-by-rename helper

- [ ] `stealIfTokenMatches` implemented; every stale-break unlink uses it
- [ ] Corrupt/invalid branches compare content
- [ ] Put-back via `linkSync`, `EEXIST` tolerated

**Artifacts:**
- `src/batch/batch-state-lock.mjs` (modified)

### Step 2: Tests

- [ ] Two-concurrent-stealers test (child processes, dead-holder fixture, ≥ 20 rounds, no overlap)
- [ ] Put-back unit test

**Artifacts:**
- `tests/batch/batch-state-lock.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` 3× (flake check)
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-803)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Two concurrent breakers of a dead holder: exactly one acquires
- [ ] A lock acquired between judge and break is never removed

## Git Commit Convention

- `fix(SP-794): steal stale batch-state lock by rename with token re-check (#302)`

## Do NOT

- Add async acquisition or change `DEFAULT_TIMEOUT_MS` (SP-797)
- Change `writeJsonAtomic` (SP-795)
- Replace the file lock with `flock` or a daemon
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- 2026-09-28: Contract `testCommand` sets `SPINE_SUPPRESS_JOURNAL_ATTACH=1` so tests run by the worker cannot write into the live batch journal (#328).
