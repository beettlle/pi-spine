# Task: SP-332 — spine scenarios CLI

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New operator CLI for listing, showing, and materializing scenario fixtures for dogfood/dev.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Add spine scenarios CLI commands: list, show, materialize.

Materialize writes batch-state + journal tail into target .spine/ (dev/dogfood only).

Guard with --force if active batch present.

## Dependencies

1. **Task:** SP-329

## Context to Read First

- `src/fixtures/scenario-registry.mjs`
- `bin/spine.mjs`
- `tests/cli/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `bin/spine.mjs`
- `bin/spine-cli/scenarios.mjs`
- `tests/cli/scenarios.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/scenarios.test.mjs` |
| fileScopeMustChange | `bin/spine-cli/scenarios.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/cli/scenarios.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Review existing CLI subcommand patterns in bin/spine-cli/
- [ ] Confirm registry API from SP-329

### Step 1: Implement spine scenarios CLI

- [ ] Add scenarios.mjs subcommand module
- [ ] Implement list, show, materialize
- [ ] Wire into bin/spine.mjs
- [ ] Add active-batch guard for materialize

### Step 2: Testing & Verification

- [ ] Add tests/cli/scenarios.test.mjs
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

- [ ] spine scenarios list/show/materialize work
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-332): complete Step N — description`
- `fix(SP-332): description`
- `test(SP-332): description`

## Do NOT

- Materialize over active batch without --force
- Auto-start batches from materialize

---

## Amendments (Added During Execution)
