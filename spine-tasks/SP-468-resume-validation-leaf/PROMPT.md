# Task: SP-468 — Resume validation leaf

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** #83-B leaf extraction; split from SP-428.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Extract pure resume validation helpers to `resume-validation.mjs` with no reconcile import ([#83](https://github.com/beettlle/pi-spine/issues/83) slice B). Split from SP-428.

## Dependencies

- **Task:** SP-424 (limbo-detect-leaf)

## Context to Read First

- GitHub issue #83 slice B
- `src/batch/resume-multi-validate.mjs`
- Parent split: SP-428
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/resume-validation.mjs`
- `src/batch/resume-multi-validate.mjs`
- `tests/batch/resume-validation-leaf.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/resume-validation-leaf.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/resume-validation.mjs` |
| artifactsMustExist | `tests/batch/resume-validation-leaf.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #83 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Leaf module

- [ ] Move pure validation helpers out of resume-multi-validate.mjs
- [ ] Ensure leaf has no reconcile import

### Step 2: Tests

- [ ] Add resume-validation-leaf regression test

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Update linked GitHub issue #83 with progress
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated


## Git Commit Convention

- `feat(SP-468): complete Step N — description`
- `fix(SP-468): description`
- `hydrate: SP-468 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
