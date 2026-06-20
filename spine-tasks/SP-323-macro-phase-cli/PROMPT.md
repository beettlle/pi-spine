# Task: SP-323 — Macro-phase in reconcile and CLI

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Wire macro-phase into reconcile output and spine status CLI; extends existing diagnosis flow.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Expose macroPhase and macroPhaseLabel in reconciliation results and CLI output.

Update src/batch/reconcile.mjs to call deriveMacroPhase.

Update bin/spine-status.mjs to print Macro phase line after diagnosis.

Include macroPhase in --diagnose verbose signals.

## Dependencies

1. **Task:** SP-322

## Context to Read First

- `src/batch/macro-phase.mjs`
- `src/batch/reconcile.mjs`
- `bin/spine-status.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/reconcile.mjs`
- `bin/spine-status.mjs`
- `tests/batch/reconcile*.test.mjs`
- `tests/cli/status*.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/macro-phase.test.mjs tests/cli/` |
| fileScopeMustChange | `src/batch/reconcile.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `(none beyond tests)` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-322 macro-phase module API
- [ ] Review existing status CLI output format

### Step 1: Wire macro-phase into reconcile and CLI

- [ ] Add macroPhase fields to reconcileBatch output
- [ ] Print macro phase in spine status output
- [ ] Include in --diagnose signals when verbose

### Step 2: Testing & Verification

- [ ] Extend reconcile/status tests
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Add phase vs diagnosis vs macroPhase table to operator-runbook
- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] spine status shows macro phase
- [ ] reconcile returns macroPhase fields
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-323): complete Step N — description`
- `fix(SP-323): description`
- `test(SP-323): description`

## Do NOT

- Replace diagnosis headline logic
- Change diagnosis suggestedCommand behavior

---

## Amendments (Added During Execution)
