# Task: SP-442 — Skip clears failed segment for wave merge

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Skip/retry merge semantics.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

After `spine batch skip`, clear failed segment classifications so batch can proceed to merge/gate when all tasks terminal — not stuck needs_retry. Closes #96.
**Closes:** [#96](https://github.com/beettlle/pi-spine/issues/96)

## Dependencies

- **Task:** SP-401 (merge-blocked resume recovery must land first)

## Context to Read First

- GitHub issue #96
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/skip-task.mjs`
- `src/batch/reconcile.mjs`
- `tests/batch/skip-clears-failed.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/skip-clears-failed.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #96 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Skip semantics

- [ ] Mark skipped tasks terminal without failed segment residue
- [ ] Reconcile allTasksTerminalSuccess without needs_retry trap

### Step 1: Regression

- [ ] Fixture: skip after false failure → resume/merge proceeds

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #96 (`gh issue close 96`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — skip vs retry

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #96 closed

## Git Commit Convention

- `feat(SP-442): complete Step N — description`
- `fix(SP-442): description`
- `hydrate: SP-442 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
