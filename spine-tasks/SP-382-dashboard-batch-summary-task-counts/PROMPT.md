# Task: SP-382 — Dashboard batch summary task counts

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** View model aggregate; issue #58 SP-D.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #58** Tier 2: batch summary line `N running · M queued · K succeeded · T total` from classifiedTasks + current wave.

## Dependencies

- **Task:** SP-379
- **Task:** SP-381 (assignment styling landed first)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/index.html`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/view.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Read buildDashboardViewModel

### Step 1: Summary counts

- [ ] Add aggregate task counts to view model
- [ ] Render in batch summary panel with wave index when available

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery



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

- `feat(SP-382): complete Step N — description`
- `fix(SP-382): description`
- `test(SP-382): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
