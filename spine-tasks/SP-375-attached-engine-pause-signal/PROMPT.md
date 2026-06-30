# Task: SP-375 — Attached engine honors pause signal

**Created:** 2026-06-30
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Attached engine loop + batch-state coupling; reliability fix.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #57** (partial): attached engine must stop advancing and persist `phase: paused` when operator runs `spine batch pause` (batch 20260630T034859).

## Dependencies

None

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/attached-runner.mjs`
- `src/batch/engine.mjs`
- `src/batch/pause.mjs`
- `tests/batch/attached-pause-persist.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/attached-pause-persist.test.mjs` |
| fileScopeMustChange | `src/batch/attached-runner.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/attached-pause-persist.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #57 timeline and journal batch 20260630T034859
- [ ] Trace pause command and attached engine tick loop

### Step 1: Pause propagation

- [ ] Ensure pause sets batch-state phase paused and engine observes it between ticks
- [ ] Regression test: pause while attached → state file phase paused

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Log root cause in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-375): complete Step N — description`
- `fix(SP-375): description`
- `test(SP-375): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
