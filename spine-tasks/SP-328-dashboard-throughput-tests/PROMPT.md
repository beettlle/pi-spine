# Task: SP-328 — Dashboard throughput contract tests

**Created:** 2026-06-20
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Contract tests and batch-state fixture for multi-lane throughput dashboard display.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Add dashboard contract tests and fixture for lane throughput display.

Extend tests/dashboard/ui-contract.test.mjs.

Add batch-state fixture with multi-lane completed tasks.

## Dependencies

1. **Task:** SP-327

## Context to Read First

- `tests/dashboard/ui-contract.test.mjs`
- `tests/fixtures/batch-state/`
- `src/dashboard/view.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `tests/dashboard/ui-contract.test.mjs`
- `tests/fixtures/batch-state/lane-throughput-multi-lane.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `tests/dashboard/ui-contract.test.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/fixtures/batch-state/lane-throughput-multi-lane.json` |

## Steps

### Step 0: Preflight

- [ ] Review SP-327 dashboard column field names
- [ ] Identify minimal fixture for multi-lane throughput

### Step 1: Add throughput contract tests and fixture

- [ ] Create batch-state fixture with multi-lane completed tasks
- [ ] Extend ui-contract tests for throughput view model
- [ ] Assert column labels and values

### Step 2: Testing & Verification

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

- [ ] Fixture and contract tests exist
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-328): complete Step N — description`
- `fix(SP-328): description`
- `test(SP-328): description`

## Do NOT

- Change production dashboard code unless tests reveal bugs

---

## Amendments (Added During Execution)
