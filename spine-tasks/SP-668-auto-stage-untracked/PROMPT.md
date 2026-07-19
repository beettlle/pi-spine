# Task: SP-668 — Auto-stage untracked files before contract verify

**Created:** 2026-07-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single-module change to contract verification; pattern is straightforward (git add untracked files matching file scope); low blast radius but touches final verification so plan review is prudent.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #219 — Before running contract verification, automatically stage any untracked files that match the task's `fileScopeMustChange` patterns so workers are not penalized for forgetting to `git add` new files. If no matching untracked files exist, behavior must remain unchanged. The change must be safe for parallel lanes and must not stage files outside the task's scope.

## Dependencies

- **None**

## Context to Read First

- `spine-tasks/CONTEXT.md` — release context and next task ID
- `src/batch/contract-verify.mjs` — current contract verification entry point
- `src/batch/lane-dirty-check-git.mjs` — lane git state helpers

## Environment

- **Workspace:** `src/batch/`
- **Services required:** None

## File Scope

- `src/batch/contract-verify.mjs`
- `src/batch/lane-dirty-check-git.mjs`
- `tests/batch/contract-untracked-files.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && node --test tests/batch/contract-untracked-files.test.mjs` |
| fileScopeMustChange | `src/batch/contract-verify.mjs`, `src/batch/lane-dirty-check-git.mjs`, `tests/batch/contract-untracked-files.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] No active batch running

### Step 1: Add untracked-file staging helper

- [ ] Locate where contract verify reads the diff for `fileScopeMustChange`
- [ ] Add a helper that lists untracked files in the lane worktree and matches them against `fileScopeMustChange` globs
- [ ] Stage matching untracked files with `git add` before the diff check
- [ ] Leave already-tracked modifications untouched

**Artifacts:**
- `src/batch/lane-dirty-check-git.mjs` (modified)

### Step 2: Wire helper into contract verify

- [ ] Call the new helper in `contract-verify.mjs` before evaluating `fileScopeMustChange`
- [ ] Ensure failure to stage is surfaced as a clear contract error, not a silent failure
- [ ] Preserve existing behavior when no untracked files exist

**Artifacts:**
- `src/batch/contract-verify.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Add regression test that creates a new file matching `fileScopeMustChange`, leaves it untracked, and asserts contract verification succeeds
- [ ] Add test that an untracked file **outside** `fileScopeMustChange` is **not** staged and does not affect verification
- [ ] Run `node --test tests/batch/contract-untracked-files.test.mjs`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update `STATUS.md` with discoveries
- [ ] No operator-runbook change required; behavior is transparent to users

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — update if contract verification section mentions manual staging

## Completion Criteria

- [ ] Untracked files matching `fileScopeMustChange` are auto-staged before contract verify
- [ ] Behavior is unchanged when no untracked files exist
- [ ] All tests pass and coverage is ≥77% on changed code
- [ ] STATUS.md updated

## Git Commit Convention

- `feat(SP-668): add untracked-file staging helper`
- `feat(SP-668): wire staging into contract verify`
- `test(SP-668): add regression tests for untracked file staging`

## Do NOT

- Expand task scope beyond #219
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

<!-- Workers add amendments here if issues discovered during execution. -->
