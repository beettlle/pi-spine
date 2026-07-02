# Task: SP-429 — Dirty worktree symlink drift handling

**Created:** 2026-07-02
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Worktree hook symlink edge case.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Ignore or repair symlink-only dirt from worktreeSetupHook paths (e.g. `assets/bundled_skins`) after final PASS — do not fail DirtyWorktree on symlink deletion drift. Closes #87.
**Closes:** [#87](https://github.com/beettlle/pi-spine/issues/87)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #87
- `spine-tasks/CONTEXT.md` Phase 52

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-dirty-check.mjs`
- `tests/batch/dirty-worktree-symlink.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/dirty-worktree-symlink.test.mjs && npm run coverage:check` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Read GitHub issue #87 acceptance criteria
- [ ] Confirm dependencies satisfied

### Step 0: Symlink policy

- [ ] Detect symlink-only dirty state from hook paths
- [ ] Re-run hook or exclude from dirty gate

### Step 1: Tests

- [ ] Fixture: PASS + symlink deletion → task succeeds

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Close GitHub issue #87 (`gh issue close 87`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — worktreeSetupHook symlink pattern

**Check If Affected:**
- `spine-tasks/CONTEXT.md` — task status

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Issue #87 closed

## Git Commit Convention

- `feat(SP-429): complete Step N — description`
- `fix(SP-429): description`
- `hydrate: SP-429 expand Step N checkboxes`

## Do NOT

- Expand task scope — log follow-ups in CONTEXT.md
- Skip tests
- Modify unrelated batch engine paths
- Ban `spine-tasks/**` in fileScopeMustNotChange

---

## Amendments (Added During Execution)
