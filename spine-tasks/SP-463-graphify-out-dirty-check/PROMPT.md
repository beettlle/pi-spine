# Task: SP-463 — Graphify-out dirty check exclusion

**Created:** 2026-07-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Extend dirty-worktree gate like SP-427/430.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Exclude `graphify-out/` from lane dirty-worktree classification (ephemeral graphify hook output). Closes [#113](https://github.com/beettlle/pi-spine/issues/113).
**Closes:** [#113](https://github.com/beettlle/pi-spine/issues/113)

## Dependencies

- **Task:** SP-430 (gitignored dirty pattern)

## Context to Read First

- GitHub issue #113
- `src/batch/lane-dirty-check.mjs` or dirty-worktree helpers
- `spine-tasks/CONTEXT.md` Phase 54

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `tests/batch/graphify-out-dirty.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/graphify-out-dirty.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |
| fileScopeMustChange | `src/batch/lane-dirty-check.mjs` |
| artifactsMustExist | `tests/batch/graphify-out-dirty.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #113 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 1: Exclusion

- [ ] Add graphify-out/ to ephemeral artifact allowlist
- [ ] Do not block merge on untracked graphify-out churn

### Step 2: Tests

- [ ] Fixture: graphify-out dirty only → not DirtyWorktree

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #113 (`gh issue close 113`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md`
- `spine-tasks/SP-457-graphify-hook-spine-batch-doc/PROMPT.md`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #113 closed

## Git Commit Convention

- `feat(SP-463): complete Step N — description`
- `fix(SP-463): description`
- `hydrate: SP-463 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
