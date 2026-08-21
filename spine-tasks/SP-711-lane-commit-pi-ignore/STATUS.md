# SP-711: Lane commit ignore .pi/ and .pi-smart-router/ — Status

**Current Step:** Step 1: Extend default ignore paths
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

**Status:** In Progress

## Step 2: Testing & Verification

**Status:** Not Started

## Step 3: Documentation & Delivery

**Status:** Not Started

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

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

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
