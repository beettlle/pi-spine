# Task: SP-329 — Scenario registry schema and module

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New fixtures registry module and JSON schema — centralizes scattered incident/stub/adoption fixture metadata.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Create scenario registry schema and core module.

New src/fixtures/scenario-registry.mjs loads tests/fixtures/scenarios/registry.json.

API: listScenarios(), getScenario(id), validateRegistry().

## Dependencies

-1. **None**

## Context to Read First

- `tests/fixtures/incidents/README.md`
- `tests/batch/orphan-reconcile.test.mjs`
- `tests/fixtures/stall-sat020/README.md`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/fixtures/scenario-registry.mjs`
- `tests/fixtures/scenarios/registry.json`
- `tests/fixtures/scenario-registry.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/fixtures/scenario-registry.test.mjs` |
| fileScopeMustChange | `src/fixtures/scenario-registry.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/fixtures/scenarios/registry.json` |

## Steps

### Step 0: Preflight

- [ ] Review existing incident README catalog
- [ ] Review duplicated loadFixture helpers in tests

### Step 1: Implement scenario registry module

- [ ] Define registry.json schema and initial minimal file
- [ ] Create scenario-registry.mjs with list/get/validate API
- [ ] Add unit tests

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

- [ ] Registry module and schema exist
- [ ] validateRegistry passes
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-329): complete Step N — description`
- `fix(SP-329): description`
- `test(SP-329): description`

## Do NOT

- Migrate all fixtures in this task (SP-330)
- Add CLI in this task (SP-332)

---

## Amendments (Added During Execution)
