# Task: SP-381 — Dashboard batch assignment task states

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** UI styling; issue #58 SP-C.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #58** Tier 1b: render batch assignment column with per-task state (✓ done, ▶ running, ○ queued, ✗ failed) from classifiedTasks.

## Dependencies

- **Task:** SP-379 (classification available on lane rows)
- **Task:** SP-380 (Running/Queued columns landed first)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`
- `src/dashboard/public/dashboard.css`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-381-dashboard-batch-assignment-states/STATUS.md` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Review issue #58 batch assignment mockup

### Step 1: Assignment styling

- [ ] Map lane.taskIds to classification badges in view model
- [ ] CSS for muted/strikethrough done, emphasis running, error failed

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

- `feat(SP-381): complete Step N — description`
- `fix(SP-381): description`
- `test(SP-381): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
