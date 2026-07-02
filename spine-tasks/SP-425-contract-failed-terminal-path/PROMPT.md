# Task: SP-425 — Contract failed terminal path

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Engine review path; affects operator taxonomy.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

When final `contract.verified` fails, classify as `contract_failed` (not final REVISE) and do not consume `maxFinalAttempts` or re-run worker by default. Journal/metrics distinguish contract vs reviewer failure. Closes #85.
**Closes:** [#85](https://github.com/beettlle/pi-spine/issues/85)

## Dependencies

- **Task:** SP-421 (diagnosis-primary-failure-class)

## Context to Read First

- GitHub issue #85
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/review.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/contract-failed-terminal.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-failed-terminal.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #85 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Terminal path

- [ ] Add contract_failed exitReason/classification in review.mjs
- [ ] Skip worker rework loop when checks indicate testCommand/env failure

### Step 1: Reconcile + metrics

- [ ] Surface contract_failed in diagnose headline
- [ ] Distinguish in run-metrics journal fields

### Step 2: Regression fixture

- [ ] Test journal path from #85 excerpt (APPROVE code → contract fail)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #85 (`gh issue close 85`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — contract_failed recovery

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #85 closed

## Git Commit Convention

- `feat(SP-425): complete Step N — description`
- `fix(SP-425): description`
- `hydrate: SP-425 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
