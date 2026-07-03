# Task: SP-477 — Integrate sync-base CLI and diagnoses

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** #91 slice 2b; split from SP-443.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Implement `spine sync-base` CLI; add `human_base_diverged` and `integrate_isolated_ok` diagnoses. Closes [#91](https://github.com/beettlle/pi-spine/issues/91) with SP-475/476.

## Dependencies

- **Task:** SP-475, SP-476

## Context to Read First

- GitHub issue #91
- `src/batch/reconcile.mjs`
- Parent split: SP-443
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/cli/sync-base.mjs`
- `src/batch/reconcile.mjs`
- `bin/spine.mjs`
- `tests/batch/integrate-sync-base.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-sync-base.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/cli/sync-base.mjs` |
| artifactsMustExist | `tests/batch/integrate-sync-base.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #91 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: sync-base + diagnosis

- [ ] Implement spine sync-base CLI command
- [ ] Add human_base_diverged + integrate_isolated_ok diagnoses

### Step 2: Runbook + delivery

- [ ] Document concurrent development §4 + sync-base workflow
- [ ] Close #91

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #91 (`gh issue close 91`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — FR-WT-08 concurrent development

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #91 closed

## Git Commit Convention

- `feat(SP-477): complete Step N — description`
- `fix(SP-477): description`
- `hydrate: SP-477 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
