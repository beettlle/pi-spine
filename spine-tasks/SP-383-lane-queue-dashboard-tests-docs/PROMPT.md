# Task: SP-383 — Lane queue dashboard tests and docs

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Tests + docs; issue #58 SP-E.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Complete **GitHub issue #58** test/doc slice: extend snapshot-lanes and ui-contract tests; update EXECUTION-FLOW, QUICK-REFERENCE, operator runbook §7.

## Dependencies

- **Task:** SP-380
- **Task:** SP-381
- **Task:** SP-382

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `tests/dashboard/snapshot-lanes.test.mjs`
- `tests/dashboard/ui-contract.test.mjs`
- `docs/EXECUTION-FLOW.md`
- `docs/QUICK-REFERENCE.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/snapshot-lanes.test.mjs tests/dashboard/ui-contract.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `spine-tasks/SP-383-lane-queue-dashboard-tests-docs/STATUS.md` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Collect acceptance tests from issue #58 test plan

### Step 1: Tests and docs

- [ ] Add lane idle, single running, queued-only scenarios
- [ ] Document Running vs Queued vs Active tasks terminology

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery



## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `docs/EXECUTION-FLOW.md`
- `docs/QUICK-REFERENCE.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-383): complete Step N — description`
- `fix(SP-383): description`
- `test(SP-383): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
