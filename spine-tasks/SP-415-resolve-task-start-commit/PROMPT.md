# Task: SP-415 — Resolve task start commit

**Created:** 2026-07-01
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Journal helper to resolve taskStartCommit for verify.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Support **GitHub issue #62**: add `resolveTaskStartCommit({ journal, taskId, laneId, batchId })` returning parent commit SHA at `task.started` (or lane branch HEAD at task boundary) for scoped contract verify.

## Dependencies

- **None**

## Context to Read First

- GitHub issue #62
- `src/batch/journal.mjs`
- journal `task.started` events

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-task-start.mjs`
- `tests/batch/contract-task-start.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-task-start.test.mjs` |
| fileScopeMustChange | `src/batch/contract-task-start.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/batch/contract-task-start.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #62 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Preflight

- [ ] Inspect journal task.started payload fields in fixtures

### Step 2: resolveTaskStartCommit

- [ ] Walk journal for task.started matching taskId/lane
- [ ] Return commit SHA from event payload or git rev-parse parent at timestamp
- [ ] Return null when unavailable (fallback to main...HEAD)

### Step 3: Unit tests

- [ ] Fixture journal with two serialized tasks — distinct start commits
- [ ] Null fallback behavior documented

### Step 4: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] "Must Update" docs modified

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Acceptance criteria met

## Git Commit Convention

- `feat(SP-415): complete Step N — description`
- `fix(SP-415): description`
- `test(SP-415): description`

## Do NOT

- Change listChangedFiles (SP-414)
- Wire engine verify hook (SP-416)

---

## Amendments (Added During Execution)
