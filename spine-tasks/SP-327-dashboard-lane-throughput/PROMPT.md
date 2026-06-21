# Task: SP-327 — Dashboard lane throughput columns

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Add Elapsed, Done, and Rate columns to dashboard lane table using lane-throughput module.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Add per-lane throughput columns to dashboard lane table.

Wire lane-throughput.mjs into buildLaneRows in src/dashboard/snapshot.mjs.

New columns: Elapsed, Done, Rate (tasks/hr).

## Dependencies

1. **Task:** SP-326

## Context to Read First

- `src/dashboard/lane-throughput.mjs`
- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `—` |

## Steps

### Step 0: Preflight

- [ ] Review lane table columns in dashboard.js
- [ ] Confirm SP-326 lane-throughput API

### Step 1: Add throughput columns to dashboard

- [ ] Wire lane stats into buildLaneRows
- [ ] Add Elapsed, Done, Rate columns to lane table UI
- [ ] Add optional summary row

### Step 2: Testing & Verification

- [ ] Extend dashboard tests
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Document throughput columns in operator-runbook dashboard section
- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Dashboard lane table shows throughput columns
- [ ] Rates are task-based
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-327): complete Step N — description`
- `fix(SP-327): description`
- `test(SP-327): description`

## Do NOT

- Show token/tps metrics
- Remove existing heartbeat/phase columns

---

## Amendments (Added During Execution)
