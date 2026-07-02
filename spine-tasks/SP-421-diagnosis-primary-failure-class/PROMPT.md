# Task: SP-421 — Diagnosis primary failure class taxonomy

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Reconcile/diagnose headline logic; operator-facing.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix misleading `spine status --diagnose` headline that says 'failed at worker launch' for DirtyWorktree, review_exhausted, and contract failures. Surface primary failure class per task with actionable suggestedCommand. Fix hasFailedTasks vs failedTasks inconsistency where present. Closes #74.
**Closes:** [#74](https://github.com/beettlle/pi-spine/issues/74)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #74
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/reconcile.mjs`
- `src/batch/diagnose.mjs`
- `tests/batch/diagnosis-failure-class.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/diagnosis-failure-class.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #74 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Preflight

- [ ] Reproduce with batch 20260701T201456 fixture or journal excerpt from #74

### Step 1: Taxonomy + headline

- [ ] Map classification → diagnosis headline + suggestedCommand
- [ ] Prefer task-level primary failure over generic worker-launch text

### Step 2: Regression tests

- [ ] Add tests for DirtyWorktree, review_exhausted, contract_failed headlines
- [ ] Assert hasFailedTasks aligns with failed task list

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #74 (`gh issue close 74`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — diagnosis table if behavior changes

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #74 closed

## Git Commit Convention

- `feat(SP-421): complete Step N — description`
- `fix(SP-421): description`
- `hydrate: SP-421 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
