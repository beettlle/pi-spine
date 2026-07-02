# Task: SP-430 — Gitignored dirty worktree detection fix

**Created:** 2026-07-02
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Lane commit gate; index vs worktree dirtiness.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix GitignoredDirtyWorktree false failures when gitignored paths (`extension/coverage/`, `node_modules/`) exist only in worktree after npm test — not in index. Do not suggest `git rm --cached` when paths are untracked. Optional auto `git clean -fdX` for known artifact dirs. Closes #95.
**Closes:** [#95](https://github.com/beettlle/pi-spine/issues/95)

## Dependencies

- **Task:** SP-427 (dirty-worktree-coverage-hygiene)

## Context to Read First

- GitHub issue #95
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `src/batch/engine-lanes/commit.mjs`
- `tests/batch/gitignored-dirty-worktree.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/gitignored-dirty-worktree.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #95 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Index vs worktree

- [ ] Distinguish index-tracked vs worktree-only gitignored dirt
- [ ] Fix remediation message when ls-files empty

### Step 1: Auto-clean policy

- [ ] Optional clean gitignored artifact dirs before dirty validation

### Step 2: Regression

- [ ] Reproduce batch 20260702T061256 SP-011 scenario

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #95 (`gh issue close 95`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — gitignored artifact dirs

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #95 closed

## Git Commit Convention

- `feat(SP-430): complete Step N — description`
- `fix(SP-430): description`
- `hydrate: SP-430 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
