# Task: SP-449 — Attached pause phase persistence

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Batch FSM + attached engine IPC; unblocks skip/retry recovery.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When `spine batch pause` records `batch.paused` in the journal, `.spine/batch-state.json` must persist `phase: paused` before CLI returns success — OR journal must not record pause until confirmed. Today attached engines can leave `phase: running`, blocking `skip`/`retry` while diagnosis is `needs_retry`. Closes [#103](https://github.com/beettlle/pi-spine/issues/103).

## Dependencies

- **Task:** SP-376 (pause fail-loud baseline — extend, do not regress)

## Context to Read First

- GitHub issue [#103](https://github.com/beettlle/pi-spine/issues/103)
- `src/batch/pause.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/pause-retry-guard.test.mjs`
- Batch `20260702T153101` recovery timeline

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/pause.mjs`
- `src/batch/engine-lanes.mjs`
- `bin/spine-batch.mjs`
- `tests/batch/pause-retry-guard.test.mjs`
- `tests/batch/pause-phase-persistence.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/pause-retry-guard.test.mjs tests/batch/pause-phase-persistence.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read issue #103 acceptance criteria
- [ ] Confirm SP-376 tests still pass (fail-loud on unconfirmed pause)

### Step 1: Phase persistence

- [ ] Attached engine honors pause signal and writes `phase: paused` to batch-state
- [ ] If pause cannot be confirmed within grace: do not leave orphan `batch.paused` journal without state match (rollback or fail loud)
- [ ] Allow `skip`/`retry` when phase is paused even if diagnosis is `needs_retry`

### Step 2: Regression fixture

- [ ] Reproduce #103: journal `batch.paused` at 21:30:25Z but batch-state still `running`
- [ ] Assert skip/retry succeed after confirmed pause

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update operator-runbook pause/skip/retry recovery
- [ ] Close GitHub issue #103 (`gh issue close 103`)
- [ ] Update `spine-tasks/CONTEXT.md`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — pause confirmation and skip/retry when needs_retry

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Issue #103 closed

## Git Commit Convention

- `feat(SP-449): complete Step N — description`
- `fix(SP-449): description`

## Do NOT

- Remove SP-376 fail-loud behavior
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
