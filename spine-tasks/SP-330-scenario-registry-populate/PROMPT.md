# Task: SP-330 — Populate scenario registry entries

**Created:** 2026-06-20
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Data-only task: populate registry.json from existing incident, SAT-020, adoption, and ABC fixtures.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Populate registry.json from existing fixtures.

Add entries for incidents README, SAT-020, adoption fixture, and ABC integration recipe.

Update incidents README to point at registry.json as source of truth.

## Dependencies

1. **Task:** SP-329

## Context to Read First

- `tests/fixtures/incidents/README.md`
- `tests/fixtures/scenarios/registry.json`
- `src/fixtures/scenario-registry.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `tests/fixtures/scenarios/registry.json`
- `tests/fixtures/incidents/README.md`
- `tests/fixtures/scenario-registry.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/fixtures/scenario-registry.test.mjs` |
| fileScopeMustChange | `tests/fixtures/scenarios/registry.json` |
| minLineCoverage | 77 |
| artifactsMustExist | `(none beyond tests)` |

## Steps

### Step 0: Preflight

- [ ] Inventory all fixture README tables
- [ ] Confirm registry schema from SP-329

### Step 1: Populate registry entries

- [ ] Add incident fixture entries
- [ ] Add SAT-020, adoption, ABC entries
- [ ] Update incidents README index
- [ ] Extend validateRegistry tests for entry count

### Step 2: Testing & Verification

- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `tests/fixtures/incidents/README.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] All cataloged fixtures have registry entries
- [ ] validateRegistry passes
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-330): complete Step N — description`
- `fix(SP-330): description`
- `test(SP-330): description`

## Do NOT

- Refactor test files in this task (SP-331)
- Add CLI commands

---

## Amendments (Added During Execution)
