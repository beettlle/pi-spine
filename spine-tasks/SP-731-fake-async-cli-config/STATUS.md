# SP-731: Remove fake-async in CLI, config, and analyze — Status

**Current Step:** Step 1
**Status:** 🔄 In Progress
**Last Updated:** 2026-08-28
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 1
**Size:** S

---

## Step 0: Preflight

**Status:** ✅ Complete

- [x] Read #270 acceptance criteria
- [x] Map callers with `rg`

**Plan (Review Level 1):** GitNexus impact on all five targets = LOW (0 upstream impacts). Approach:
- `analyzeTasksScope`, `buildWorkerContextAsync`, `runSpineSettingsSlash` are fully synchronous (no `await`, no promise path) → drop `async`, add `@returns` JSDoc. Existing `await` callers keep working (await on non-promise is identity).
- `runJournalFollow` / `runLaneLogs` return a real `Promise` only on the follow path (fs.watch + signals) → drop `async`; follow path keeps returning the explicit Promise; non-follow paths return plain result objects; JSDoc `@returns` documents the union. Callers all `await`, so no breakage.
- No renames (`buildWorkerContextAsync` name kept — renaming ripples into out-of-scope `src/batch/worker-prompt.mjs` and batch tests; mission only requires sync-or-real-await).

## Step 1: Remove fake-async (sync path)

**Status:** ✅ Complete

- [x] Drop `async` or add real `await` on five exports
- [x] Update callers / JSDoc
- [x] Preserve behavior

## Step 2: Testing & Verification

**Status:** 🔄 In Progress

- [x] Run lint
- [ ] Run Contract `testCommand`
- [ ] Fix failures

## Step 3: Documentation & Delivery

**Status:** ⬜ Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-28 | Task staged | v2.17.0 release Phase 3 |
| 2026-08-28 | Step 0 complete | Callers mapped: bin/spine.mjs, bin/spine-cli/lane-logs.mjs, bin/spine-tasks.mjs:304, src/batch/worker-prompt.mjs:64, extensions/spine/settings-slash.ts; all `await` the targets |
| 2026-08-28 | Step 1 complete | Dropped `async` on all five exports; `@returns` JSDoc added; follow paths in journal-follow/lane-logs keep real Promise (fs.watch + signals) |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
