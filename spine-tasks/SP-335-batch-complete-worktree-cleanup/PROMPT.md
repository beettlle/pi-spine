# Task: SP-335 — Batch complete worktree cleanup

**Created:** 2026-06-28
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** `removeLaneWorktrees` exists but only runs on engine failure/abort — successful `complete`/`dismiss` leaves stale worktrees and branches.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Fix **GitHub issue #26**: after `spine batch complete` or `dismiss`, lane worktrees under `.worktrees/spine-<batchId>/` and `task/spine-lane-*` branches persist indefinitely.

**Required behavior:**

1. Call `removeLaneWorktrees` from `completeBatch()` and `dismissBatch()` behind `lanes.cleanupWorktreesOnComplete` (default true).
2. Journal event `batch.worktrees_cleaned` for auditability.
3. Doctor/preflight `stale-worktrees` check for dirs with no active batch.
4. Regression test: complete batch removes lane worktrees.

**Closes:** [#26](https://github.com/beettlle/pi-spine/issues/26)

## Dependencies

- **None**

## Context to Read First

- GitHub issue #26
- Related modules in File Scope

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/worktree.mjs`
- `src/doctor/run-doctor-checks.mjs`
- `src/config/defaults.mjs`
- `tests/batch/worktree-cleanup-on-complete.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/worktree-cleanup-on-complete.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/worktree-cleanup-on-complete.test.mjs` |

## Steps

### Step 0: Preflight: trace complete/dismiss paths

- [ ] Preflight: trace complete/dismiss paths

### Step 1: Wire cleanup on terminal lifecycle

- [ ] Wire cleanup on terminal lifecycle

### Step 2: Doctor stale-worktrees check

- [ ] Doctor stale-worktrees check

### Step 3: Tests + delivery

- [ ] Tests + delivery

### Step 4: Testing & Verification

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

### Step 5: Documentation & Delivery

- [ ] Close issue #26 (`gh issue close 26`)
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Issue #26 behavior fixed
- [ ] Tests pass with coverage gate
- [ ] Issue closed

## Git Commit Convention

- `feat(SP-335): complete Step N — description`
- `fix(SP-335): description`
- `test(SP-335): description`

## Do NOT

- Expand scope beyond issue #26 acceptance criteria
- Silence failures without journal + diagnosis record

---

## Amendments (Added During Execution)
