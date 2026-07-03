# Task: SP-446 — Diagnosis for doneInLane pending drift

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Diagnosis FSM; surfaces stuck batches to operators.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Update `deriveDiagnosis()` so when `hasRunningTasks: false`, pending tasks remain, and reconcile shows `doneInLane`/`terminal-success` drift, diagnosis is `state_drift` or `needs_retry` (not generic `running`). Suggested command should name retry/skip/resume path. Part of [#100](https://github.com/beettlle/pi-spine/issues/100) fix (bullet 2 of 4).

## Dependencies

- **Task:** SP-445 (doneInLane drift detection)

## Context to Read First

- GitHub issue [#100](https://github.com/beettlle/pi-spine/issues/100)
- `src/batch/diagnosis.mjs`
- `src/batch/diagnosis-task-done.mjs`
- `src/batch/status-json.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/diagnosis.mjs`
- `src/batch/diagnosis-task-done.mjs`
- `src/batch/diagnosis-alternatives.mjs`
- `src/batch/status-json.mjs`
- `tests/batch/diagnosis-failure-class.test.mjs`
- `tests/batch/status-json.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/diagnosis-failure-class.test.mjs tests/batch/status-json.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-445 drift entries available in reconcile signals
- [ ] Read #100 repro: `hasRunningTasks: false` + pending + lane `.DONE`

### Step 1: Diagnosis rules

- [ ] Map doneInLane/cache drift to `state_drift` or `needs_retry` (not `running`)
- [ ] Headline + `suggestedCommand` for operator (retry pending tasks or `resume --force`)
- [ ] Wire `stateDrift.drifted` from SP-445 into diagnosis signals

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` diagnosis table
- [ ] Update `spine-tasks/CONTEXT.md`
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — state_drift / doneInLane pending diagnosis

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Diagnosis no longer reports generic `running` for #100 repro fixture

## Git Commit Convention

- `feat(SP-446): complete Step N — description`
- `fix(SP-446): description`

## Do NOT

- Close issue #100 here (SP-447)
- Modify dashboard UI (SP-447)

---

## Amendments (Added During Execution)
