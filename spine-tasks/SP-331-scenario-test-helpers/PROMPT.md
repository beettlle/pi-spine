# Task: SP-331 — Centralize scenario materialize helpers

**Created:** 2026-06-20
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Consolidate duplicated loadFixture/materializeIncidentFixture into shared test helper; no behavior change.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Centralize test scenario materialize helpers.

New tests/helpers/scenario-fixture.mjs: loadScenario(id), materializeScenario(projectRoot, id).

Refactor orphan-reconcile, journal-rebuild-incidents, orphan-detect-scope to use helper. No behavior change.

## Dependencies

1. **Task:** SP-329
2. **Task:** SP-330

## Context to Read First

- `tests/batch/orphan-reconcile.test.mjs`
- `tests/batch/journal-rebuild-incidents.test.mjs`
- `tests/helpers/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `tests/helpers/scenario-fixture.mjs`
- `tests/batch/orphan-reconcile.test.mjs`
- `tests/batch/journal-rebuild-incidents.test.mjs`
- `tests/batch/orphan-detect-scope.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/orphan-reconcile.test.mjs tests/batch/journal-rebuild-incidents.test.mjs tests/batch/orphan-detect-scope.test.mjs` |
| fileScopeMustChange | `tests/helpers/scenario-fixture.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/helpers/scenario-fixture.mjs` |

## Steps

### Step 0: Preflight

- [ ] Identify duplicated loadFixture patterns
- [ ] Confirm registry entries from SP-330

### Step 1: Create shared helper and refactor tests

- [ ] Create tests/helpers/scenario-fixture.mjs
- [ ] Refactor orphan-reconcile, journal-rebuild-incidents, orphan-detect-scope
- [ ] Verify identical test outcomes

### Step 2: Testing & Verification

- [ ] Run refactored test files
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- None

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Shared helper exists
- [ ] Refactored tests pass unchanged
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-331): complete Step N — description`
- `fix(SP-331): description`
- `test(SP-331): description`

## Do NOT

- Change fixture JSON contents
- Add CLI commands

---

## Amendments (Added During Execution)
