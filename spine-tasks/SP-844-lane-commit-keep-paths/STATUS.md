# SP-844: Lane commits keep tool state and earlier tasks' .DONE markers — Status

**Current Step:** Step 1
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
**Status:** ⬜ Not Started

- [ ] Failing test: two tasks committed in sequence on one lane worktree; the first task's `.DONE` must survive the second lane commit
- [ ] Record the deleting call path in STATUS.md Discoveries

### Step 2: Keep paths + single sanitizer
**Status:** ⬜ Not Started

- [ ] `lanes.laneCommitKeepPaths` schema + settings field (default `[".review/"]`)
- [ ] Keep-path filtering in `lane-commit-keep-paths.mjs`; sanitizer skips kept roots
- [ ] Delete `lane-dirty-check-commit.mjs`; repoint tests

### Step 3: Fix `.DONE` deletion
**Status:** ⬜ Not Started

- [ ] Fix the path found in Step 1; Step 1 test passes
- [ ] Test: `.review/session.json` and `.review/spine-stet-baseline.ref` survive a lane commit; `.pi-smart-router/` still cleaned

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

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-22 | Task staged | PROMPT.md created |
| 2026-10-23 | Step 0 preflight | Impact CRITICAL/HIGH recorded; 2 refs to lane-dirty-check-commit found (both tests/) |

## Blockers

*None*
