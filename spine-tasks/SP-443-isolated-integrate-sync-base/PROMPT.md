# Task: SP-443 — Isolated integrate sync-base and doctor

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Completes #91 operator surfaces.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Complete #91: `spine sync-base` (or documented workflow), human_base_diverged diagnosis, doctor concurrent-dev warnings, integrate config defaults (`integrate.isolatedWorktree`, `allowHumanOnBaseBranch`). Closes #91.
**Closes:** [#91](https://github.com/beettlle/pi-spine/issues/91)

## Dependencies

- **Task:** SP-436 (isolated-integrate-core)

## Context to Read First

- GitHub issue #91
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/reconcile.mjs`
- `src/config/spine-preflight-lib.mjs`
- `src/cli/sync-base.mjs`
- `templates/spine-config.json`
- `tests/batch/integrate-sync-base.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-sync-base.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #91 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Config + doctor

- [ ] Add integrate.* config defaults
- [ ] Doctor warns active batch + human on baseBranch

### Step 1: sync-base + diagnosis

- [ ] Implement sync-base CLI
- [ ] Add human_base_diverged + integrate_isolated_ok diagnoses

### Step 2: Runbook

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
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #91 closed

## Git Commit Convention

- `feat(SP-443): complete Step N — description`
- `fix(SP-443): description`
- `hydrate: SP-443 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
