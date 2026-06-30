# Task: SP-379 — Lane queue snapshot helpers

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Pure dashboard projection; issue #58 SP-A.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #58** Tier 1a: add `computeRunningTaskIdForLane` and `computeQueuedTaskIdsForLane` in snapshot layer; wire into lane rows with additive `runningTaskId` / `queuedTaskIds`; keep deprecated `activeTaskIds`.

## Dependencies

None

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/snapshot.mjs`
- `tests/dashboard/snapshot-lanes.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/snapshot-lanes.test.mjs` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read issue #58 design Tier 1
- [ ] Read computeActiveTaskIdsForLane

### Step 1: Snapshot helpers

- [ ] Add running/queued helpers using classifiedTasks + lane.taskIds order
- [ ] Wire buildLaneRows; populate activeTaskIds as running+queued for compat

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Note deprecated activeTaskIds in STATUS

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-379): complete Step N — description`
- `fix(SP-379): description`
- `test(SP-379): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
