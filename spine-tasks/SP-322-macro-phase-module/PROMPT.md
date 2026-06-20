# Task: SP-322 — deriveMacroPhase module

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** New pure derivation module mapping diagnosis + batch signals to operator macro-phase enum.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Create deriveMacroPhase — a pure function mapping batch lifecycle signals to a stable macro-phase enum.

New module src/batch/macro-phase.mjs accepts diagnosis, batch.phase, wave index, merge results, gate record, postMergeLimbo, integrate journal events.

Output enum: idle, planning, executing, merging, reviewing, gating, integrating, completed, failed, aborted, paused.

## Dependencies

-1. **None**

## Context to Read First

- `src/batch/reconcile.mjs`
- `src/batch/diagnosis.mjs`
- `src/dashboard/snapshot.mjs`
- `tests/fixtures/batch-state/`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/macro-phase.mjs`
- `tests/batch/macro-phase.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/macro-phase.test.mjs` |
| fileScopeMustChange | `src/batch/macro-phase.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/macro-phase.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Review diagnosis taxonomy and batch.phase values
- [ ] Identify fixture snapshots covering each macro-phase

### Step 1: Implement deriveMacroPhase

- [ ] Create src/batch/macro-phase.mjs with enum and deriveMacroPhase()
- [ ] Document mapping table in module header
- [ ] Export macroPhaseLabel helper

### Step 2: Testing & Verification

- [ ] Add tests/batch/macro-phase.test.mjs using batch-state fixtures
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

- [ ] deriveMacroPhase module exists with tests
- [ ] All macro-phase enum values covered by fixtures

## Git Commit Convention

- `feat(SP-322): complete Step N — description`
- `fix(SP-322): description`
- `test(SP-322): description`

## Do NOT

- Replace diagnosis taxonomy
- Add batch-state schema fields

---

## Amendments (Added During Execution)
