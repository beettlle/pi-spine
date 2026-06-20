# Task: SP-324 — Dashboard macro-phase in batch summary

**Created:** 2026-06-20
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Dashboard batch summary panel shows macro-phase alongside wave progress; banner still uses diagnosis.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Show macroPhaseLabel in dashboard batch summary panel alongside wave progress.

Update src/dashboard/snapshot.mjs, src/dashboard/view.mjs, and src/dashboard/public/dashboard.js.

Banner continues using diagnosis for styling; macro-phase is informational only.

## Dependencies

1. **Task:** SP-322

## Context to Read First

- `src/batch/macro-phase.mjs`
- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `tests/dashboard/ui-contract.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/dashboard/snapshot.mjs`
- `src/dashboard/view.mjs`
- `src/dashboard/public/dashboard.js`
- `tests/dashboard/ui-contract.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs` |
| fileScopeMustChange | `src/dashboard/snapshot.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `(none beyond tests)` |

## Steps

### Step 0: Preflight

- [ ] Review batch summary panel structure in dashboard.js
- [ ] Confirm macro-phase module API from SP-322

### Step 1: Add macro-phase to dashboard batch summary

- [ ] Wire macroPhaseLabel in snapshot builder
- [ ] Render in batch summary panel with wave progress
- [ ] Keep diagnosis banner styling unchanged

### Step 2: Testing & Verification

- [ ] Extend ui-contract tests
- [ ] Run FULL test suite
- [ ] Run coverage gate — ≥77%

### Step 3: Documentation & Delivery

- [ ] Update docs/PRD.md §16.1 if applicable
- [ ] Create .DONE

## Documentation Requirements

**Must Update:**

- `docs/PRD.md`
- `docs/adoption/operator-runbook.md`

**Check If Affected:**

- `docs/EXECUTION-FLOW.md`

## Completion Criteria

- [ ] Dashboard shows macro phase in batch summary
- [ ] Banner still uses diagnosis
- [ ] Tests pass

## Git Commit Convention

- `feat(SP-324): complete Step N — description`
- `fix(SP-324): description`
- `test(SP-324): description`

## Do NOT

- Switch banner styling to macro-phase
- Remove existing diagnosis badge

---

## Amendments (Added During Execution)
