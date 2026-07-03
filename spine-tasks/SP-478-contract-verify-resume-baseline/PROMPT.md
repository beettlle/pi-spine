# Task: SP-478 — Contract verify resume baseline

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Baseline fix only; split from SP-461.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix false `fileScopeMustChange` negatives after pause/retry/resume — compare against task-start baseline on lane branch ([#105](https://github.com/beettlle/pi-spine/issues/105) partial). Split from SP-461.

## Dependencies

- **Task:** SP-415, SP-416

## Context to Read First

- GitHub issue #105
- `src/batch/contract-verify.mjs`
- Parent split: SP-461
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/contract-task-start.mjs`
- `tests/batch/contract-resume-baseline.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/contract-resume-baseline.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/contract-verify.mjs` |
| artifactsMustExist | `tests/batch/contract-resume-baseline.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #105 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Baseline fix

- [ ] Persist task-start commit across retry/resume
- [ ] Verify diff uses task boundary not stale post-rework tree

### Step 2: Tests

- [ ] Fixture: lane commit exists but verifier false negative → pass after fix

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #105 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — contract verify after resume

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-478): complete Step N — description`
- `fix(SP-478): description`
- `hydrate: SP-478 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
