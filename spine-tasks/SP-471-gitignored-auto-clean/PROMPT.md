# Task: SP-471 — Gitignored auto-clean before dirty gate

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Auto-clean policy; split from SP-430.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Optional `git clean -fdX` for known gitignored artifact dirs before lane dirty validation. Closes [#95](https://github.com/beettlle/pi-spine/issues/95) with SP-470.

## Dependencies

- **Task:** SP-427, SP-470
- **Task:** SP-494 (stet Option A bootstrap)

## Context to Read First

- GitHub issue #95
- `src/batch/lane-dirty-check.mjs`, `engine-lanes/commit.mjs`
- Parent split: SP-430
- `spine-tasks/CONTEXT.md` Phase 55

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/engine-lanes/commit.mjs`
- `tests/batch/gitignored-auto-clean.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/gitignored-auto-clean.test.mjs && npm run coverage:check && stet start HEAD --allow-dirty --quiet && stet run --strictness lenient --auto-finish-zero --quiet` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs` |
| artifactsMustExist | `tests/batch/gitignored-auto-clean.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #95 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Auto-clean policy

- [ ] Add optional git clean -fdX for known artifact dirs before dirty check
- [ ] Wire into lane commit path

### Step 2: Tests

- [ ] extension/coverage and node_modules worktree-only dirt does not block merge

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] If `stet run` fails: fix code OR file GitHub issue(s) on beettlle/pi-spine (label `stet`) before marking done — see Stet findings policy in CONTEXT.md
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #95 (`gh issue close 95`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — gitignored auto-clean policy

**Check If Affected:**
- `spine-tasks/CONTEXT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #95 closed

## Git Commit Convention

- `feat(SP-471): complete Step N — description`
- `fix(SP-471): description`
- `hydrate: SP-471 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
