# Task: SP-350 — Worktree cleanup on complete/dismiss

**Created:** 2026-06-28
**Size:** S
**Split from:** SP-335

## Review Level: 1 (Plan Only)

**Assessment:** Wire existing removeLaneWorktrees into terminal batch lifecycle.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Part of **GitHub issue #26** (split from SP-335): call `removeLaneWorktrees` from `completeBatch()` and `dismissBatch()` behind `lanes.cleanupWorktreesOnComplete` (default true); emit `batch.worktrees_cleaned` journal event.

**Required behavior:**

1. Call `removeLaneWorktrees` from complete and dismiss paths.
2. Journal `batch.worktrees_cleaned` with batchId and lane count.
3. Regression test: complete batch removes lane worktrees.

**Issue:** [#26](https://github.com/beettlle/pi-spine/issues/26) — delivery shared with split sibling

## Dependencies

- **None**

## File Scope

- `src/batch/lifecycle.mjs`
- `src/batch/worktree.mjs`
- `src/config/defaults.mjs`
- `tests/batch/worktree-cleanup-on-complete.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/worktree-cleanup-on-complete.test.mjs` |
| fileScopeMustChange | `src/batch/lifecycle.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/worktree-cleanup-on-complete.test.mjs` |

## Steps

### Step 0: Preflight
- [ ] Read issue #26 and superseded SP-335 PROMPT

### Step 1: Implementation
- [ ] Implement required behavior

### Step 2: Testing & Verification
- [ ] Contract test passes
- [ ] FULL suite + coverage gate

### Step 3: Delivery
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Required behavior implemented
- [ ] Tests pass with coverage gate


## Do NOT

- Expand beyond split scope from SP-335

---
## Amendments (Added During Execution)
