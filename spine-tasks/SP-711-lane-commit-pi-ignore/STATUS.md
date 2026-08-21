# SP-711: Lane commit ignore .pi/ and .pi-smart-router/ — Status

**Current Step:** Step 3: Documentation & Delivery
**Status:** In Progress
**Last Updated:** 2026-08-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** Completed

- [x] `.venv` default ignore confirmed (`DEFAULT_WORKTREE_SETUP_IGNORE_PATHS`, SP-640) at `src/config/spine-config-load.mjs:22`
- [x] Lane commit path confirmed: `engine-lanes.mjs:450` / `matrix-run.mjs:542` pass `resolveWorktreeSetupIgnorePaths(config)` into `commitLaneWorktree`; `lane-commit.mjs` falls back to the defaults when `ignorePatterns` is omitted
- Plan review at Step 1 checkpoint: skipped by design in real-pi session (engine reviews after `.DONE`)

## Step 1: Extend default ignore paths

**Status:** Completed

- [x] Added `.pi` and `.pi-smart-router` to `DEFAULT_WORKTREE_SETUP_IGNORE_PATHS`
- [x] New `tests/batch/lane-commit-pi-ignore.test.mjs`: defaults, resolver union, `filterPorcelain` under-tree filtering, fileScope opt-in, and two `commitLaneWorktree` git-fixture integration tests
- [x] Fixed hardcoded `[".venv", "pi-spine"]` assertion in `tests/batch/lane-commit.test.mjs` to spread defaults

## Step 2: Testing & Verification

**Status:** Completed

- [x] Contract `testCommand` green: `npm run typecheck` clean; 10/10 tests pass (`lane-commit-pi-ignore` 6/6, `pi-smart-router-dirty` 4/4)
- [x] Regression: `tests/batch/lane-commit.test.mjs` 11/11 pass

## Step 3: Documentation & Delivery

**Status:** In Progress

- [x] `docs/adoption/operator-runbook.md` — added #255 row noting default lane-commit ignores for pi agent runtime dirs

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| 2026-08-21 | 1 | plan | SKIPPED (real-pi session; engine reviews post-.DONE, SP-195) |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-19 | Task staged | PROMPT.md and STATUS.md created for v2.14.1 release |
| 2026-08-21 | Step 0 complete | Preflight confirmed; matcher `pathMatchesIgnorePattern` matches `?? .pi/` via `path.posix.basename` (same as `.venv`) — no matcher change needed |
| 2026-08-21 | Discovery | `tests/batch/lane-commit.test.mjs` hardcodes `[".venv", "pi-spine"]` — must spread defaults to stay green (logically required, outside fileScope) |
| 2026-08-21 | Discovery | `initGitRepo` fixture runs `spine init`, which gitignores `.pi/` (SP-652) — integration tests strip that entry to simulate a legacy consumer repo without the gitignore |
| 2026-08-21 | Steps 1–2 complete | Defaults extended; tests written; contract testCommand green |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
