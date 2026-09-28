# SP-798: Lane merge out-of-scope fail-closed — Status

**Current Step:** 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-09-28
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Reproduce discard
- [x] Consumers listed
- [x] Dependencies satisfied

### Step 1: Allow-list + fail-closed resolver
**Status:** ✅ Complete

- [x] Allow-list default
- [x] Blob + ours / fail closed
- [x] Dead computation removed

### Step 2: Journal + failure classification + resume parity
**Status:** ✅ Complete

- [x] Journal event + return field
- [x] `MergeFailed` classification
- [x] Resume parity; `resume.mjs` ≤ 500

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Real conflict fails closed
- [ ] Allow-listed journaled
- [ ] Untracked-overwrite
- [ ] Resume parity

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Repro (temp repo, `/tmp/sp798-repro/repro.mjs`): both sides edit out-of-scope `parallel.ts` → `mergeLaneToOrch` returns `ok:true`, lane blob (`v = 99`) silently discarded, 0 journal events, no discard field. |
| 2 | Consumers of current shapes: `engine.mjs:417` + `resume-multi.mjs:209` (via `mergeWaveLanesToOrch`), `resume.mjs:455` (calls without `laneFileScopePaths`), `integrate-worktree.mjs:12` (deprecated `tryAutoResolveRulesManifestMergeConflict` wrapper — no file scope passed, out-of-scope branch unreachable → integrate unaffected). |
| 3 | GitNexus impact: `mergeLaneToOrch` LOW (2 direct callers); `tryAutoResolveMergeConflicts` flagged HIGH because shared, but the out-of-scope branch is only reachable from lane→orch merges with file scope — blast radius confined as intended. |
| 4 | `tests/batch/merge-gitignored-paths.test.mjs` test 3 (`extension/coverage/lcov-report/index.html` real out-of-scope conflict) relies on prefer-orch auto-resolution → under fail-closed it must configure `lanes.outOfScopeMergeAllowList` in the fixture. Consequential edit outside File Scope; required by Step 4 "fix all failures". |
| 5 | `tests/batch/rules-manifest-merge.test.mjs:231` asserts generic conflict error matches `/automatic resolution supports/` — new error text must keep that phrase. |
| 6 | `tests/helpers/git-fixture.mjs` `initGitRepo` runs spine init → temp repos have `.spine/spine-config.json`, so `loadSpineConfig` succeeds there and `applyConfigDefaults` fills the new `lanes.outOfScopeMergeAllowList` default. |
| 7 | `minimalValidPromptMarkdown` helper (tests/helpers/smoke-task-prompt.mjs) supports custom `fileScope` — used for the `mergeWaveLanesToOrch` journal test task folder. |
| 8 | Step 1+2 implementation: `tryAutoResolveMergeConflicts` loads the allow-list via `loadSpineConfig` (defaults fill via `applyConfigDefaults`, verified on a runInit temp repo), derives laneNumber from the branch name, and returns `discardedOutOfScope`; `mergeLaneToOrch` classifies zero-unmerged-path merge failures as `MergeFailed` with piped stderr (`err.stderr` Buffer) and propagates `discardedOutOfScope`; `mergeWaveLanesToOrch` journals `batch.merge_out_of_scope_discarded` `{laneNumber, taskBranch, paths, laneBlobs}`. `resume.mjs` single-line parity fix keeps it at 498 lines. |
| 9 | `tests/batch/merge-gitignored-paths.test.mjs` test 3 fixed per discovery #4 by committing `lanes.outOfScopeMergeAllowList: ["extension/coverage/lcov-report/index.html"]` into the fixture's `.spine/spine-config.json` before branching — 10/10 pass. |

## Blockers

_None._
