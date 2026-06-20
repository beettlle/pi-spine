# Task: SP-311 — Merge gitignored path filter

**Created:** 2026-06-19
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Wave merge fails when lane branches contain gitignored artifacts (coverage, `__pycache__`) that workers committed; `git add` during merge conflict resolution rejects ignored paths and fails the batch despite all tasks succeeding.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Fix **GitHub issue #15**: batch merge fails with `git add` on gitignored paths after all tasks report `succeeded`. Observed in stet batch `20260619T234638` — lane 3 merge failed on `extension/coverage/lcov-report/*.html` while `failedTasks: 0`.

**Required behavior:**

1. **Merge staging:** Before any `git add` during lane→orch merge or conflict auto-resolution, skip paths where `git check-ignore -q` succeeds. Never fail the batch solely because a gitignored path cannot be staged.
2. **Lane commit guard:** `commitLaneWorktree` must not stage or commit gitignored paths (extend SP-104 scoped filter). Surface refused paths in `task.failed` / journal when workers leave gitignored dirty files.
3. **Diagnosis:** Add `merge_failed_gitignored` (or equivalent `failureClass`) distinguishable from task failure in `spine status --diagnose`; include `suggestedCommand` with repair steps (drop cached ignored paths on task branch, `spine batch resume --force`).
4. **Regression test:** Fixture with gitignored coverage committed on task branch → wave merge succeeds without operator `git rm --cached` surgery.

**Closes:** [#15](https://github.com/beettlle/pi-spine/issues/15)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #15 (full reproduction and operator workaround)
- `src/batch/engine-lanes/merge.mjs` — `tryAutoResolveOutOfScopeMergeConflict`, `mergeLaneToOrch`
- `src/batch/merge/adoption-doc-merge.mjs` — `git add` during adoption doc resolution
- `src/batch/lane-commit.mjs` — `commitLaneWorktree` (SP-104 scoped filter)
- `src/batch/diagnosis.mjs` — failure taxonomy and `suggestedCommand`
- `spine-tasks/SP-104-lane-commit-hardening/PROMPT.md` — prior lane commit hardening

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/engine-lanes/merge.mjs`
- `src/batch/merge/adoption-doc-merge.mjs`
- `src/batch/lane-commit.mjs`
- `src/batch/diagnosis.mjs`
- `src/batch/git-helpers.mjs` (new shared helper, if extracted)
- `tests/batch/merge-gitignored-paths.test.mjs` (new)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/merge-gitignored-paths.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/merge.mjs`, `src/batch/lane-commit.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/merge-gitignored-paths.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Reconstruct issue #15 failure path (`git add` on `extension/coverage/...`)
- [ ] List all `git add` call sites in merge and lane-commit modules
- [ ] Confirm no existing `git check-ignore` helper in `src/batch/`

### Step 1: Filter gitignored paths in merge and lane commit

- [ ] Add `filterGitignoredPaths(projectRoot, paths)` using `git check-ignore -q` (or batch equivalent)
- [ ] Wrap merge conflict resolution `git add` paths — skip ignored; log skipped paths to journal
- [ ] Extend `commitLaneWorktree` to exclude gitignored paths from staging; fail or warn with path list when only ignored files remain dirty

### Step 2: Diagnosis and recovery hints

- [ ] Map merge failures caused by ignored-path staging to `failureClass: merge_failed_gitignored` (or extend `MergeConflict` with explicit sub-reason)
- [ ] Set `suggestedCommand` naming `git rm --cached` repair on task branch + `spine batch resume --force`
- [ ] Update operator-runbook merge recovery section if behavior changes

### Step 3: Testing & Verification

- [ ] Regression: task branch with committed gitignored coverage → wave merge succeeds
- [ ] Regression: lane commit refuses to stage gitignored-only dirty paths
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 4: Documentation & Delivery

- [ ] Update `docs/adoption/operator-runbook.md` merge recovery if repair flow changed
- [ ] Close issue #15 (`gh issue close 15`)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — gitignored merge failure recovery (if new diagnosis path)

**Check If Affected:**

- `docs/design/integrate-conflict-recovery.md` — merge failure taxonomy

## Completion Criteria

- [ ] Merge never fails solely on `git add` of gitignored paths
- [ ] Lane commit does not persist gitignored artifacts
- [ ] Diagnosis distinguishes merge/gitignored from task failure
- [ ] Tests pass with coverage gate
- [ ] Issue #15 closed

## Git Commit Convention

- `feat(SP-311): complete Step N — description`
- `fix(SP-311): description`
- `test(SP-311): description`

## Do NOT

- Broaden scope to full `spine batch repair-merge` CLI (document manual repair only)
- Use blind `git add -A` in merge paths
- Silence merge failures without journal + diagnosis record

---

## Amendments (Added During Execution)
