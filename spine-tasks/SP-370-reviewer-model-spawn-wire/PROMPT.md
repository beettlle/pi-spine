# Task: SP-370 — Wire per-type reviewer model into spawn

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Spawn argv wiring only; helpers exist from SP-369.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Wire **GitHub issue #53** (partial): pass `reviewType` through `buildReviewerPiArgs` / `spawnReviewerPi` so plan/code/final spawns use resolved model and thinking pins.

## Dependencies

- **Task:** SP-369 (resolution helpers must exist)

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/review-spawn.mjs`
- `tests/batch/review-spawn.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/review-spawn.test.mjs` |
| fileScopeMustChange | `src/batch/review-spawn.mjs` |
| minLineCoverage | `77` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-369 helpers exported
- [ ] Read existing review-spawn tests

### Step 1: Wire spawn path

- [ ] Pass reviewType into buildReviewerPiArgs
- [ ] Extend review-spawn tests: per-type override, fallback, inherit cascade

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery

- [ ] Log spawn behavior notes in STATUS.md

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-370): complete Step N — description`
- `fix(SP-370): description`
- `test(SP-370): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
