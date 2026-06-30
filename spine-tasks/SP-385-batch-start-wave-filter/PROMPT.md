# Task: SP-385 — Batch start --wave filter

**Created:** 2026-06-30
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Planner wave scope filter; issue #54 Tier 1 SP-A.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement **GitHub issue #54** Tier 1: `spine batch start pending --wave N` resolves only planner wave N task IDs; actionable error for invalid/empty waves.

## Dependencies

None

## Context to Read First

- GitHub issues referenced in Mission
- `spine-tasks/CONTEXT.md` Phase 47

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/planner/wave-scope.mjs`
- `bin/spine-batch.mjs`
- `src/batch/engine-scope.mjs`
- `tests/planner/wave-scope.test.mjs`
- `tests/batch/batch-start-wave.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/planner/wave-scope.test.mjs tests/batch/batch-start-wave.test.mjs` |
| fileScopeMustChange | `src/planner/wave-scope.mjs` |
| minLineCoverage | `77` |
| artifactsMustExist | `tests/planner/wave-scope.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #54 Tier 1 acceptance
- [ ] Read buildPlan waves shape

### Step 1: Wave filter

- [ ] Add wave-scope helper and CLI --wave flag parsing
- [ ] Filter taskIds before startBatch; dry-run parity test

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

### Step 3: Documentation & Delivery



## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

- `feat(SP-385): complete Step N — description`
- `fix(SP-385): description`
- `test(SP-385): description`

## Do NOT

- Expand scope beyond issue acceptance criteria
- Close GitHub issue without verified fix on main

---

## Amendments (Added During Execution)
