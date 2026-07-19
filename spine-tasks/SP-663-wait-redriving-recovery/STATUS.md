### Step 0: Batch-scoped wait
**Status:** ✅ Complete

- [x] Modify `src/cli/wait.mjs` so `spine wait` targets the specific batch ID.
- [x] Add `archived`/`superseded` status (exit 2, batch-scoped output).

### Step 1: Update tests
**Status:** ✅ Complete

- [x] Update `tests/cli/wait.test.mjs` to simulate batch archiving under a wait.

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] `npm test` passes
- [x] `npm run coverage:check` ensures ≥77% line coverage

## Discoveries

| Finding | Detail |
| --- | --- |
| PROMPT path typos | PROMPT referenced `src/batch/wait.mjs`, `src/batch/diagnose.mjs`, `tests/batch/wait.test.mjs` — none exist. Real files: `src/cli/wait.mjs`, `src/batch/diagnosis.mjs`, `tests/cli/wait.test.mjs` (confirmed via sibling tasks SP-360/SP-362 which use `src/cli/`). Corrected path refs in Context/File Scope/Contract/Steps + Amendments note so engine contract verify resolves real files. |

## Notes

- Step 1 added 6 tests: superseded (batchId drift), archived (batch disappears), json-snapshot scoping, same-batch-no-false-supersede, archived-phase-from-disk, corrupt-archive tolerance. All 24 wait tests pass.
