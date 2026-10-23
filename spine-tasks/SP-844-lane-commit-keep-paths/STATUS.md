# SP-844: Lane commits keep tool state and earlier tasks' .DONE markers — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-22
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `sanitizeGitignoredArtifactsBeforeLaneCommit`, `commitLaneWorktree`, `commitLaneAndValidateWorktree`
- [ ] `rg -n "lane-dirty-check-commit" src bin tests scripts` — record every reference

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

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-22 | Task staged | PROMPT.md created |

## Blockers

*None*
