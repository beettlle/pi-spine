# TP-035: /spine-settings interactive menu — Status

**Status:** In Progress | **Last Updated:** 2026-06-02 | **Review Level:** 1 | **Size:** S

### Step 0 — Done | Step 1 — Done | Step 2 — In Progress

## Summary

Implemented `/spine-settings` as a menu-first operator surface (FR-CFG-03): lists all five editable registry fields with live values and `spine settings set` hints; optional `/spine-settings set <path> <value>` delegates to TP-034 `runSpineSettingsSet`. Core logic in `src/cli/settings-slash.mjs`; pi extension wrapper in `extensions/spine/settings-slash.ts`.

## Baseline

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (289 → 294 tests)

## Step notes

- **Step 0:** Reviewed `spineStatusHandler` notify patterns; baseline green after `npm install` in worktree.
- **Step 1:** `formatSettingsSlashMenu`, `runSpineSettingsSlash`, wired `spine-settings` handler (stub removed), five tests in `tests/spine-settings-slash.test.mjs`, README FR-CFG-03 row updated.
- **Step 2:** Full suite passes; manual `/spine-settings` in pi not run in this lane (extension requires pi host).

## Commits

_(pending step boundary commit)_
