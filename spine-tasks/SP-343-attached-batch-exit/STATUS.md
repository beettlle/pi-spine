# SP-343: Attached batch exit after complete — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #34 reviewed
- [x] File scope modules read

**Plan (Step 1):** Root cause is attached CLI never calls `process.exit(0)` on success (`writeCommandResult` only exits on failure) and engine journal milestones were not streamed to stdout. Add `attached-runner.mjs` milestone reporter + `finishAttachedBatchCli`, wire `spine-batch.mjs` attached start/resume paths.

### Step 1: Stdout milestones + exit on complete
**Status:** ✅ Complete

- [x] Stdout milestones + exit on complete

### Step 2: Tests + delivery
**Status:** ✅ Complete

- [x] Tests + delivery

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Contract test passes
- [x] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [x] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** (87.82%)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Close issue #34 (`gh issue close 34`)
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `writeCommandResult` only exits on non-zero; attached success left event loop alive | Fixed via `finishAttachedBatchCli` | `src/batch/attached-runner.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-28 | Task staged | PROMPT.md and STATUS.md created for GitHub #34 |
| 2026-06-30 | Step 1 implemented | Milestone reporter + attached CLI exit wired |
| 2026-06-30 | Verification | 1144/1144 tests pass; coverage 87.82% |
| 2026-06-30 | Delivery | Issue #34 closed; `.DONE` created |

---

## Blockers

*None*

---

## Notes

Attached `--attached` paths in `bin/spine-batch.mjs` now use `runAttachedBatchEngine`, `formatAttachedBatchCliResult`, and `finishAttachedBatchCli` from `src/batch/attached-runner.mjs`.
