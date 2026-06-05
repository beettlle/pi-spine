# Task: SP-101 — Normalize lane worktree gitdir paths

**Created:** 2026-06-05
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Lane worktrees get container-absolute gitdir pointers that break host git and devcontainer lane-only mounts; engine must normalize paths at provision and on resume repair.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

After `git worktree add`, rewrite lane worktree `.git` pointer files to use **relative** `gitdir` paths valid on host and in devcontainer. Expose health check + idempotent repair for resume on broken worktrees.

**Bug:** searchATon batch `20260605T160800` — lane `.git` contained `/workspace/.git/worktrees/lane-N`.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `src/batch/worktree.mjs` — `provisionLaneWorktree`
- `src/batch/engine.mjs` — provision loop (~164–179)
- `src/batch/resume-multi.mjs` — lane worktree resolution
- `tests/helpers/git-fixture.mjs` — test repo helpers

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worktree.mjs`
- `src/batch/engine.mjs`
- `src/batch/resume-multi.mjs`
- `tests/batch/worktree-git-paths.test.mjs` (new)

## Steps

### Step 0: Preflight

- [ ] Read bug report pattern: lane `.git` → `gitdir: /workspace/...`
- [ ] Confirm `provisionLaneWorktree` has no post-add normalization today

### Step 1: Normalize git metadata at provision

> **Plan-review checkpoint**

- [ ] Add `normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath, laneNumber })` — relative paths only, forward slashes
- [ ] Update admin file `.git/worktrees/lane-N/gitdir` with relative path to lane `.git`
- [ ] Call from `provisionLaneWorktree()` after `git worktree add`
- [ ] Add `assertLaneWorktreeGitHealthy(worktreePath)` — `git rev-parse` + `git status --porcelain`
- [ ] Call `spine_review_step` (plan)

### Step 2: Resume repair + tests

> **Code review checkpoint**

- [ ] Export `repairLaneWorktreeGitMetadata` (idempotent) for resume preflight when health check fails
- [ ] Wire repair in `resume-multi.mjs` before worker spawn
- [ ] Tests: provision lane → host `git status` in worktree succeeds; no absolute `/workspace` in `.git`
- [ ] Call `spine_review_step` (code)

### Step 3: Testing & Verification

- [ ] FULL suite: `npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 npm test`
- [ ] Coverage gate: `npm run coverage:check` — **≥77%**

### Step 4: Documentation & Delivery

- [ ] STATUS.md discoveries

## Documentation Requirements

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (brief note on relative gitdir)

## Completion Criteria

- [ ] Fresh batch lane worktrees pass `git status` on host from worktree cwd
- [ ] `.git` gitfile uses relative `gitdir`, not `/workspace/...`

## Git Commit Convention

- `feat(SP-101): normalize lane worktree gitdir paths`
- `test(SP-101): worktree git path regression`

## Do NOT

- Implement `worktreeSetupHook` (SP-102)
- Set `PI_SPINE_ROOT` (SP-103)

---

## Amendments (Added During Execution)
