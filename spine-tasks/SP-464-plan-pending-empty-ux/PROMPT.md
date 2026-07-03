# Task: SP-464 — Plan pending empty backlog UX

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** CLI UX for empty pending plan scope.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

`spine plan pending` with all `.DONE` tasks prints friendly summary (excluded count, next commands) without stack trace; exit 0 informational. Closes [#99](https://github.com/beettlle/pi-spine/issues/99).
**Closes:** [#99](https://github.com/beettlle/pi-spine/issues/99)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #99
- `src/planner/scope.mjs`, `bin/spine-plan.mjs`
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/scope.mjs`
- `bin/spine-plan.mjs`
- `tests/planner/plan-pending-empty.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/planner/plan-pending-empty.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/planner/scope.mjs` |
| artifactsMustExist | `tests/planner/plan-pending-empty.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #99 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: UX handler

- [ ] Catch no-pending-tasks in plan CLI
- [ ] Format like preflight plan section; no stack unless --verbose

### Step 2: Tests

- [ ] All .DONE → exit 0 + summary
- [ ] Suggest spine plan all

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #99 (`gh issue close 99`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — plan pending idle state

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #99 closed

## Git Commit Convention

- `feat(SP-464): complete Step N — description`
- `fix(SP-464): description`
- `hydrate: SP-464 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
