# SP-844: Lane commits keep tool state and earlier tasks' .DONE markers — Status

**Current Step:** Step 4
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-23
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `sanitizeGitignoredArtifactsBeforeLaneCommit`, `commitLaneWorktree`, `commitLaneAndValidateWorktree`
- [x] `rg -n "lane-dirty-check-commit" src bin tests scripts` — record every reference

### Step 1: Reproduce `.DONE` deletion
**Status:** ✅ Complete

- [x] Failing test: two tasks committed in sequence on one lane worktree; the first task's `.DONE` must survive the second lane commit
- [x] Record the deleting call path in STATUS.md Discoveries

### Step 2: Keep paths + single sanitizer
**Status:** ✅ Complete

- [x] `lanes.laneCommitKeepPaths` schema + settings field (default `[".review/"]`)
- [x] Keep-path filtering in `lane-commit-keep-paths.mjs`; sanitizer skips kept roots
- [x] Delete `lane-dirty-check-commit.mjs`; repoint tests

### Step 3: Fix `.DONE` deletion
**Status:** ✅ Complete

- [x] Fix the path found in Step 1; Step 1 test passes
- [x] Test: `.review/session.json` and `.review/spine-stet-baseline.ref` survive a lane commit; `.pi-smart-router/` still cleaned

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Runbook: `lanes.laneCommitKeepPaths` and the #349 workaround it replaces
- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-844-lane-commit-keep-paths/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Impact `commitLaneWorktree`: risk CRITICAL — 4 direct callers (`commitLaneAndValidateWorktree`, `markTaskCompleteFromDisk`, `runResumedTaskOnLane`, `resumeBatch`), 6 processes across Engine-lanes + Batch modules | Acknowledged; task explicitly targets this path; minimal signature-preserving edits | src/batch/lane-commit.mjs |
| Impact `commitLaneAndValidateWorktree`: risk HIGH — direct callers `runNonMatrixTaskOnLane`, `runMatrixTaskOnLane`, reaching `startBatch` | Acknowledged | src/batch/engine-lanes/commit.mjs |
| `sanitizeGitignoredArtifactsBeforeLaneCommit` duplicated: live copy in `lane-dirty-check.mjs` (2 direct callers) + dead-ish copy in `lane-dirty-check-commit.mjs` (0 direct callers per graph) | Confirms Step 2 consolidation; delete duplicate | src/batch/lane-dirty-check.mjs:326, src/batch/lane-dirty-check-commit.mjs:203 |
| `rg lane-dirty-check-commit` hits: `tests/arch/ts-nocheck-guard.test.mjs:84`, `tests/batch/pi-smart-router-dirty.test.mjs:12` (import of `GITIGNORED_ARTIFACT_MARKERS`). No src/bin/scripts references | Both in file scope; repoint/delete in Step 2 | tests/ |
| Deleting call path (#349): `commitLaneWorktree` (lane-commit.mjs:395) post-commit → `sanitizeGitignoredArtifactsBeforeLaneCommit` (lane-dirty-check.mjs:327) → `listGitignoredArtifactRoots` maps `.review/session.json` → root `.review` → `git clean -fdX -- .review` wipes session.json + spine-stet-baseline.ref. Same sanitizer also runs pre-commit via `commitLaneAndValidateWorktree` (engine-lanes/commit.mjs:50) — deletion happens at task A's own commit, breaking task B's stet-gated contract. `.DONE` markers themselves survive today (committed + outside artifact roots); keep-path assertions guard the fix against broader cleaning | Confirmed by red test `two tasks serialized on one lane keep .review state and both .DONE markers` | src/batch/lane-commit.mjs, src/batch/lane-dirty-check.mjs, src/batch/engine-lanes/commit.mjs |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-22 | Task staged | PROMPT.md created |
| 2026-10-23 | Step 0 preflight | Impact CRITICAL/HIGH recorded; 2 refs to lane-dirty-check-commit found (both tests/) |
| 2026-10-23 | Step 1 reproduce | Red test written; deleting path = sanitizer `git clean -fdX -- .review` pre+post lane commit |
| 2026-10-23 | Step 2 keep paths | New stringList settings type (first array-typed field); lane-commit-keep-paths.mjs written without @ts-nocheck (guard allowlist closed); lane-dirty-check.mjs at exactly 500 lines (criterion ≤500) |
| 2026-10-23 | Step 3 fix | Keep-path fix also had to cover commitLaneWorktree's GitignoredDirtyWorktree gate: kept `.review/` residue after pre-commit sanitize previously failed the only-gitignored-dirty branch; kept paths now filtered before the gate (only-kept → ok committed:false, matching pre-fix pi-smart-router behavior). engine-lanes/commit.mjs passes config-derived keepPaths; commitLaneWorktree falls back to disk-config resolution. engine-lanes-commit-order test needs env -u SPINE_IS_WORKER (nested-batch guard, pre-existing, unrelated) |

## Blockers

*None*
