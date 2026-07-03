# Task: SP-483 — Post-merge sync: git restore fails on test-generated paths not in HEAD

**Created:** 2026-07-03
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Single-function fix in integrate-worktree; low blast radius, existing error-handling pattern, no security or data-model impact.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-483-post-merge-sync-restore-safety/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

`syncPlumbingMergePathsToWorktree` in `src/batch/integrate-worktree.mjs` runs `git restore --source=HEAD --worktree -- <path>` on every changed path after a merge. When test-generated paths (e.g. `coverage/`) exist in the worktree but not in HEAD, the command fails with `pathspec did not match`, marking the batch as failed even though the task and contract passed.

Fix the function to gracefully skip paths that don't exist in HEAD — either by pre-filtering against `git ls-tree HEAD` or by catching the specific pathspec error and continuing.

**Closes:** [#130](https://github.com/beettlle/pi-spine/issues/130)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `src/batch/integrate-worktree.mjs` — `syncPlumbingMergePathsToWorktree` implementation

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/integrate-worktree.mjs`
- `tests/batch/integrate-worktree-sync.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/integrate-worktree-sync.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `src/batch/integrate-worktree.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/integrate-worktree-sync.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] `src/batch/integrate-worktree.mjs` exists and contains `syncPlumbingMergePathsToWorktree`
- [ ] Understand how changed paths are collected and passed to `git restore`

### Step 1: Filter or guard git restore paths

- [ ] Before calling `git restore`, verify each path exists in HEAD (via `git ls-tree --name-only HEAD -- <path>` or equivalent)
- [ ] Skip paths that are not tracked in HEAD with a debug-level log message
- [ ] Alternatively, catch the specific `pathspec did not match` error per-path and continue
- [ ] Run targeted tests: `npm test -- tests/batch/integrate-worktree`

**Artifacts:**
- `src/batch/integrate-worktree.mjs` (modified)

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Add test: `syncPlumbingMergePathsToWorktree` succeeds when worktree contains paths not in HEAD
- [ ] Add test: paths that exist in HEAD are still restored correctly
- [ ] Fix all failures

**Artifacts:**
- `tests/batch/integrate-worktree-sync.test.mjs` (new)

### Step 3: Documentation & Delivery

- [ ] Note the fix in CONTEXT.md discoveries if relevant
- [ ] "Check If Affected" docs reviewed

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — remove workaround note if present

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `syncPlumbingMergePathsToWorktree` no longer fails on test-generated paths absent from HEAD
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-483): complete Step N — description`
- **Bug fixes:** `fix(SP-483): description`
- **Tests:** `test(SP-483): description`
- **Hydration:** `hydrate: SP-483 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message

---

## Amendments (Added During Execution)
