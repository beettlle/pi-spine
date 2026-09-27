# Task: SP-784 — Integrate checkout sync safety

**Created:** 2026-09-27
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Integrate writes into the operator's live checkout; today it can overwrite uncommitted edits and stage base changes onto a feature branch.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** After a successful integrate, `syncPlumbingMergePathsToWorktree` runs `git restore --source <merge> --staged --worktree` for every merged path in `projectRoot`, whichever branch is checked out and without a dirty check. The refs-only merge (chosen when base is *not* checked out) returns `mode: "plumbing"` and still syncs, so base changes land in a feature branch's index. With base checked out, a dirty merged path is silently overwritten. The docstring's "without resetting human edits" is false.

## Mission

Closes #298 (with SP-782) — Integrate never touches a checkout that is not on base, never overwrites uncommitted edits, and reports any skipped overlap.

1. **Sync only when base is checked out now** — in `src/batch/integrate.mjs`, run the post-merge sync only when `isBranchCheckedOutInWorktree(projectRoot, baseBranch)` is true at sync time (not "at start"). Otherwise skip the sync entirely; the merge commit is already on the base ref.
2. **Dirty-path protection** — inside `syncPlumbingMergePathsToWorktree` (`src/batch/integrate-worktree.mjs`), intersect merged paths with `listIntegrateDirtyPaths(projectRoot)` (`rules-manifest-drift.mjs`). Skip dirty paths and return them as `skippedDirtyPaths`. Fix the docstring.
3. **Report the overlap** — when `skippedDirtyPaths` is non-empty, integrate still succeeds (`mergeCommitLanded: true`), journals `integrate.dirty_overlap` with the path list, and adds a `warnings` entry (`DirtyOverlap: <paths> kept local edits — run git diff / git restore --source <base> -- <path> after review`).
4. **Delete dead code** — remove the unreachable `git checkout <base>` + `git reset --hard HEAD` block with the bare `catch {}` (`integrate.mjs` ~lines 413–420), and the now-unused `baseCheckedOutAtStart` if nothing else reads it.
5. **Salvage parity** — apply the same "base checked out now" check and dirty skip in `src/batch/salvage-batch-integrate.mjs` (~lines 361–366).
6. **Tests** — integrate while on a feature branch leaves `git status --porcelain` unchanged; base checked out with a dirty merged path keeps the edit and reports the overlap; salvage path covered by the same assertion.

## Dependencies

- **Task:** SP-782 (rewrites the merge helpers in the same two files; this task builds on that code)

## Context to Read First

- `src/batch/integrate.mjs` — post-merge sync block (~lines 395–440)
- `src/batch/integrate-worktree.mjs` — `syncPlumbingMergePathsToWorktree` (~lines 254–333), `isBranchCheckedOutInWorktree` (~line 76)
- `src/batch/rules-manifest-drift.mjs` — `listIntegrateDirtyPaths`
- `src/batch/salvage-batch-integrate.mjs` — sync after salvage merge (~lines 361–380)
- `tests/batch/integrate-isolated.test.mjs` (feature-branch case ~lines 214–251), `tests/batch/integrate-worktree-sync.test.mjs`
- GitHub #298 ("Checkout sync" section)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset (`env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER …`)

## File Scope

- `src/batch/integrate.mjs`
- `src/batch/integrate-worktree.mjs`
- `src/batch/salvage-batch-integrate.mjs`
- `tests/batch/integrate-isolated.test.mjs`
- `tests/batch/integrate-worktree-sync.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/integrate-isolated.test.mjs tests/batch/integrate-worktree-sync.test.mjs tests/batch/integrate-base-cas.test.mjs` |
| fileScopeMustChange | `src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs`, `tests/batch/integrate-worktree-sync.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-782 is on `main` (`integrate-base-cas.test.mjs` exists; no `mergeOrchIntoBaseViaRefs`)
- [ ] Reproduce both #298 checkout effects in a scratch repo test (feature-branch staging, dirty overwrite)
- [ ] Record line counts; `integrate.mjs`, `integrate-worktree.mjs`, `salvage-batch-integrate.mjs` must each stay ≤ 500
- [ ] Dependencies satisfied

### Step 1: Safe sync in integrate

- [ ] Sync gated on base checked out at sync time
- [ ] Dirty paths skipped inside `syncPlumbingMergePathsToWorktree`; `skippedDirtyPaths` returned; docstring fixed
- [ ] `integrate.dirty_overlap` journal event + `DirtyOverlap` warning; integrate still succeeds
- [ ] Dead checkout/reset block removed

**Artifacts:**
- `src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs` (modified)

### Step 2: Salvage parity

- [ ] Same gate and dirty skip in `salvage-batch-integrate.mjs`

**Artifacts:**
- `src/batch/salvage-batch-integrate.mjs` (modified)

### Step 3: Tests

- [ ] Feature-branch integrate: `git status --porcelain` unchanged before/after
- [ ] Base checked out + dirty merged path: edit preserved, overlap reported
- [ ] Salvage path assertion

**Artifacts:**
- `tests/batch/integrate-isolated.test.mjs`, `tests/batch/integrate-worktree-sync.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run integrate + salvage tests: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/integrate*.test.mjs tests/batch/salvage*.test.mjs`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-789 documents `DirtyOverlap` in the runbook)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` §4 Land loop, §4.2 Integrate sync timeout

## Completion Criteria

- [ ] Integrate on a feature branch leaves its index and working tree untouched
- [ ] Integrate with a dirty merged path preserves the edit and reports the overlap
- [ ] Dead checkout/reset code removed
- [ ] Contract green
- [ ] Closes #298 (with SP-782)

## Git Commit Convention

- `fix(SP-784): never overwrite operator checkout edits during integrate sync (#298)`

## Do NOT

- Revert or weaken SP-782's compare-and-swap
- Use `git reset --hard`, `git checkout -f`, or any restore of a dirty path
- Redesign integrate modes
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
