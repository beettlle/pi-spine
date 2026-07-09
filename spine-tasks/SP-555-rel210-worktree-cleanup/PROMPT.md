# Task: SP-555 — v2.1.0 worktree cleanup completion

**Created:** 2026-07-09
**Size:** S

## Review Level: 2 (Plan + Code)

**Assessment:** Worktree lifecycle on abort/dismiss and empty batch-dir removal.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Complete [#169](https://github.com/beettlle/pi-spine/issues/169): SP-350/351 landed complete/dismiss cleanup; remaining gaps:

1. **Hard abort** path removes lane worktrees when `lanes.cleanupWorktreesOnHardAbort` is true (default)
2. **Empty** `.worktrees/spine-<batchId>/` parent removed after lane cleanup
3. Optional: `spine cleanup worktrees [--dry-run]` to prune stale batch dirs and dangling refs

**Closes:** [#169](https://github.com/beettlle/pi-spine/issues/169)

## Dependencies

- **Task:** SP-553

## Context to Read First

- [`docs/PRD-v2.1.0-backlog-drain-handoff.md`](../../docs/PRD-v2.1.0-backlog-drain-handoff.md) §FR-REL210-02
- [`src/batch/abort.mjs`](../../src/batch/abort.mjs)
- [`src/batch/lifecycle.mjs`](../../src/batch/lifecycle.mjs)
- [`src/batch/worktree.mjs`](../../src/batch/worktree.mjs)
- SP-350, SP-351 (prior work)

## File Scope

- `src/batch/abort.mjs`
- `src/batch/lifecycle.mjs`
- `src/batch/worktree.mjs`
- `bin/spine-cleanup.mjs`
- `tests/batch/worktree-cleanup-abort.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worktree-cleanup-abort.test.mjs` |
| fileScopeMustChange | `src/batch/worktree.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read issue #169 reproduction steps
- [ ] Trace abort vs dismiss vs complete cleanup paths

### Step 1: Abort + empty shell cleanup

- [ ] Wire `removeLaneWorktrees` on hard abort when config allows
- [ ] Remove empty `.worktrees/spine-<batchId>/` after lane removal
- [ ] Journal `batch.worktrees_cleaned` on abort path

### Step 2: Optional cleanup CLI

- [ ] `spine cleanup worktrees --dry-run` lists stale dirs/worktrees
- [ ] `--yes` prunes empty shells and calls `git worktree prune`

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 4: Documentation & Delivery

- [ ] Update operator runbook worktree section
- [ ] Comment on #169
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Abort/dismiss/complete all remove lane worktrees per config
- [ ] Empty batch parent dirs removed on happy path

## Git Commit Convention

- `fix(SP-555): complete worktree cleanup on abort and empty shells`

## Do NOT

- Delete worktrees with uncommitted operator changes without `--force` flag
