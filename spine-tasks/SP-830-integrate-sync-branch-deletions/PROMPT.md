# Task: SP-830 — Integrate removes branch-deleted paths from the base checkout

**Created:** 2026-10-14
**Size:** S

## Review Level: 2 (Plan + Code)

**Risk:** This code deletes files in the operator's checkout. A wrong condition could delete operator work or a live nested worktree. Deletion must be opt-in (integrate and salvage only), skip dirty paths, and never remove a gitlink's directory.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** With the base branch checked out, `runIntegrateMerge` (`src/batch/integrate.mjs` ~70-79) → `mergeOrchIntoBaseIsolated` → `plumbingMergeOrchIntoBase` (`src/batch/integrate-worktree.mjs` ~161-216) moves the base ref with `update-ref`. The fast-forward path does the same through `casUpdateBaseRef`. `integrate.mjs` ~349 then calls `syncMergeResultToCheckedOutBase` (`integrate-worktree.mjs` ~404-414) with `preMergeDirtyPaths`, which calls `syncPlumbingMergePathsToWorktree` (~295-386). That function lists `git diff-tree --name-only -r <merge> <base>` and runs `git restore --source <merge> --staged --worktree` on each path, but a path absent from the merge commit hits `if (!existsInMerge) { debugSyncLog(...); continue; }` (~343-348). Files deleted on the orch branch therefore stay in the checkout's index (and on disk) and show as staged additions against the new HEAD. In v2.27.1 wave 0, SP-828's deleted gitlink `.review/worktrees/stet-0ca229b1c13e` (mode 160000) was left staged after `31cd2314` and cleared by hand with `git rm --cached` (#346). `salvage-batch-integrate.mjs` ~354 uses the same sync. `spine sync-base` (`src/cli/sync-base.mjs` ~173, ~215, ~281) calls `syncPlumbingMergePathsToWorktree` directly, including when HEAD has diverged from base; deletions there could remove the operator's commits, so it must keep today's behavior. `integrate-worktree.mjs` is 498 lines (batch module limit 500).

## Mission

Closes #346 — After integrate or salvage with the base branch checked out, paths deleted on the orch branch are removed from the checkout, so `git status` is clean.

1. **New module `src/batch/integrate-path-delete.mjs`**: export `removeMergeDeletedPath(projectRoot, baseSha, filePath, { timeoutMs })` returning `{ removed: boolean, gitlink?: boolean }`.
   - `git ls-tree <baseSha> -- <filePath>`; if there is no entry, return `{ removed: false }` (the path was never on base; keep today's skip).
   - `git rm -q --cached --ignore-unmatch -- <filePath>`.
   - When the mode is not `160000`, remove the file from disk (`fs.rmSync(..., { force: true })`; files only, never `recursive`). When it is `160000`, leave the directory: it may be a live nested worktree.
   - Use `execFileSync` with the `timeout` option and `stdio: ["ignore", "pipe", "pipe"]`; rethrow timeouts so the caller reports `timedOut` like its other git calls. Do not import from `integrate-worktree.mjs` (no import cycle).
2. **`syncPlumbingMergePathsToWorktree`**: replace the `!existsInMerge` branch. When the path is dirty and operator-touched (the existing `operatorTouched` rule), push it to `skippedDirtyPaths`. Otherwise, when `options.applyDeletions === true`, call `removeMergeDeletedPath` and count a removal in `processedPaths`. Otherwise keep the debug log and skip. Add `applyDeletions` to the JSDoc options. Net change in the file: 2 lines or fewer.
3. **`syncMergeResultToCheckedOutBase`**: forward `{ ...options, applyDeletions: true }` for both the fast-forward and plumbing modes. Do not change `sync-base.mjs`, `integrate.mjs`, or `salvage-batch-integrate.mjs`.
4. **Tests** in `tests/batch/integrate-worktree-sync.test.mjs`, using its `initGitRepo` / `destroyGitRepo` helpers. In each, commit on an orch branch, check out `main`, move `refs/heads/main` to the orch commit with `git update-ref` (as integrate does), then sync:
   - tracked file deleted on orch, via `syncMergeResultToCheckedOutBase(projectRoot, "main", { mode: "fast-forward", baseShaBefore, mergeCommit }, {})` → file gone from disk and `git status --porcelain` is empty;
   - gitlink deleted on orch (create it with `git update-index --add --cacheinfo 160000,<any commit sha>,sub` and a `sub/` directory) → no index entry for `sub`, `sub/` still exists;
   - deleted file the operator edited before the sync (passed in `dirtyPaths`) → listed in `skippedDirtyPaths` and still on disk;
   - `syncPlumbingMergePathsToWorktree` without `applyDeletions` → the deleted file is still in the index (today's behavior, which `sync-base` relies on).

**Coordination with SP-823:** SP-823 swaps the import at `integrate-worktree.mjs` line 12 and the call near ~432. This task edits ~295-414 only, so the merge should be clean. If SP-823 has already landed, re-check the line count against 500.

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh default`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)

## Context to Read First

- GitHub #346
- `src/batch/integrate-worktree.mjs` 150-415
- `src/batch/integrate.mjs` 330-370
- `src/cli/sync-base.mjs` 165-290 (callers that must not change behavior)
- `tests/batch/integrate-worktree-sync.test.mjs` (whole file, 198 lines)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/integrate-path-delete.mjs`
- `src/batch/integrate-worktree.mjs`
- `tests/batch/integrate-worktree-sync.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/integrate-worktree-sync.test.mjs tests/batch/integrate-fast-forward.test.mjs tests/batch/integrate-isolated.test.mjs tests/batch/integrate-sync-base.test.mjs tests/batch/integrate-timeout.test.mjs tests/batch/integrate.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh default` |
| fileScopeMustChange | `src/batch/integrate-path-delete.mjs`, `src/batch/integrate-worktree.mjs`, `tests/batch/integrate-worktree-sync.test.mjs` |
| fileScopeMustNotChange | `.review/**`, `src/cli/sync-base.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `syncPlumbingMergePathsToWorktree` and `syncMergeResultToCheckedOutBase` — record callers in Discoveries
- [ ] Record the line count of `integrate-worktree.mjs`
- [ ] Dependencies satisfied

### Step 1: Deletion helper and opt-in

- [ ] `removeMergeDeletedPath` (gitlink keeps its directory)
- [ ] `applyDeletions` branch in the sync loop (dirty skip first)
- [ ] `syncMergeResultToCheckedOutBase` opts in

**Artifacts:**
- `src/batch/integrate-path-delete.mjs` (new)
- `src/batch/integrate-worktree.mjs` (modified)

### Step 2: Tests

- [ ] Four cases above

**Artifacts:**
- `tests/batch/integrate-worktree-sync.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] `integrate-worktree.mjs` is 500 lines or fewer
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/operator-runbook.md` integrate section (only if it tells operators to clear deleted paths by hand)

## Completion Criteria

- [ ] After integrate or salvage with base checked out, branch-deleted paths leave no staged entry
- [ ] Dirty paths and gitlink directories are never deleted
- [ ] `spine sync-base` behavior is unchanged

## Git Commit Convention

- `fix(SP-830): integrate removes branch-deleted paths from the base checkout (#346)`

## Do NOT

- Apply deletions in `spine sync-base`
- Use `git rm` without `--cached`, or `fs.rmSync` with `recursive`
- Add lines to `integrate-worktree.mjs` beyond the 500-line limit
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
