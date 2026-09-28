# Task: SP-793 — Rename bypassWriteGuard to bypassOwnerCheck and justify every remaining site

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Touches every bypassed batch-state write (attached handoff, detached wait, resume, limbo finalize); a wrong migration can reject a legitimate engine write.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 2
**Problem theory:** After SP-790, `bypassWriteGuard: true` only skips the live-foreign-owner check, but the name still says "skip the guard". Sites were added one by one as clobber workarounds (#301 counts 17 across 12 files). Some load-then-save outside the lock and should use `updateSpineBatchState` (SP-791) instead of bypassing. `resume-gate-reopen.mjs` ~34 is the gate path the issue names.

## Mission

Closes #301 — The bypass option says what it does, the number of bypass sites goes down, and every remaining site is justified.

1. **Rename** the option to `bypassOwnerCheck` in `src/batch/state-io.mjs` (`saveSpineBatchState`, `updateSpineBatchState`) and `src/batch/pause.mjs` (`saveEngineBatchState` passthrough). Do not keep a `bypassWriteGuard` alias. Update tests that pass the old name.
2. **Reduce**: for each site in `rg -n "bypassWriteGuard" src`, decide:
   - *load-mutate-save of the current batch* → migrate to `updateSpineBatchState(projectRoot, (draft) => { … })` and drop the bypass when the owner check is not needed;
   - *engine writing its own batch after PID hand-off* (e.g. the engine clears its PID, or a detached child records its new PID) → keep `bypassOwnerCheck: true`;
   - *intentional recovery rebuild* → keep `allowArchivedResurrection: true` from SP-790.
   `resume-gate-reopen.mjs` (gate reopen) migrates to `updateSpineBatchState`.
3. **Justify**: record a table in STATUS.md Discoveries — file:line, before, after, one-line reason. Target: fewer bypass sites than the 17 counted in #301 (report the before/after count). No code comments defending bypasses.
4. **Tests**: update call sites in tests for the rename; add a case in `tests/batch/batch-state-update.test.mjs` proving `resume-gate-reopen` reopens through the helper and does not clobber a concurrent `phase: "paused"`.

## Dependencies

- **Task:** SP-790 (owner-only bypass semantics, `allowArchivedResurrection`)
- **Task:** SP-791 (`updateSpineBatchState` helper)

## Context to Read First

- GitHub #301 (evidence: bypass counts; acceptance criterion "bypass call sites are reduced and each one is justified")
- SP-790 STATUS.md Discoveries — bypass-site classification from that task
- `src/batch/state-io.mjs` — `saveSpineBatchState`, `updateSpineBatchState`
- `src/batch/resume-gate-reopen.mjs` ~34

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/state-io.mjs`
- `src/batch/pause.mjs`
- `src/batch/attached-engine-handoff.mjs`
- `src/batch/attached-runner-promote.mjs`
- `src/batch/attached-runner-reconcile.mjs`
- `src/batch/batch-meta-reconstruct.mjs`
- `src/batch/detached-wait.mjs`
- `src/batch/parent-session-monitor.mjs`
- `src/batch/post-merge-limbo.mjs`
- `src/batch/resume-gate-reopen.mjs`
- `src/batch/resume-multi.mjs`
- `tests/batch/batch-state-update.test.mjs`
- `tests/batch/batch-state-lock.test.mjs`
- `tests/batch/batch-state-stale-writer.test.mjs`
- `tests/batch/batch-state-handoff.test.mjs`
- `tests/batch/pause-phase-persistence.test.mjs`
- `tests/batch/pause-retry-guard.test.mjs`
- `tests/batch/sequence-detached-poll.test.mjs`
- `tests/batch/engine-liveness-starttime.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/batch-state-update.test.mjs tests/batch/batch-state-lock.test.mjs tests/batch/batch-state-stale-writer.test.mjs tests/batch/pause-phase-persistence.test.mjs tests/batch/pause-retry-guard.test.mjs tests/batch/post-merge-limbo.test.mjs tests/batch/late-finalize-after-complete.test.mjs tests/batch/resume-multi-engine.test.mjs` |
| fileScopeMustChange | `src/batch/state-io.mjs`, `src/batch/resume-gate-reopen.mjs` |
| fileScopeMustNotChange | `src/batch/abort.mjs`, `src/batch/lifecycle.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-790 and SP-791 landed
- [ ] `rg -n "bypassWriteGuard" src tests` — record the before count
- [ ] Dependencies satisfied

### Step 1: Rename

- [ ] `bypassOwnerCheck` in `state-io.mjs` and `pause.mjs`; no alias
- [ ] All `src` and `tests` references updated

**Artifacts:**
- `src/batch/state-io.mjs`, `src/batch/pause.mjs` (modified)

### Step 2: Reduce + migrate

- [ ] Each site classified and migrated or kept
- [ ] `resume-gate-reopen.mjs` uses `updateSpineBatchState`

**Artifacts:**
- Bypass-site files listed in File Scope (modified as needed)

### Step 3: Justify + tests

- [ ] Before/after table in STATUS.md Discoveries; after-count < before-count
- [ ] Gate-reopen concurrent-pause test

**Artifacts:**
- `tests/batch/batch-state-update.test.mjs` (modified)

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
- `docs/adoption/operator-runbook.md` — any mention of `bypassWriteGuard`

## Completion Criteria

- [ ] `bypassWriteGuard` no longer exists in `src` or `tests`
- [ ] Bypass sites reduced; each remaining site justified in STATUS.md
- [ ] Gate reopen goes through `updateSpineBatchState`
- [ ] Closes #301 (with SP-790, SP-791, SP-792 on `main`)

## Git Commit Convention

- `refactor(SP-793): bypassOwnerCheck rename and bypass-site audit (#301)`

## Do NOT

- Change `abort.mjs` or `lifecycle.mjs` (SP-792 / SP-796)
- Change guard semantics beyond the rename (SP-790 owns them)
- Change lock acquisition (SP-794, SP-797)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
