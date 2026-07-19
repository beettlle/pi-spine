### Step 0: Batch-scoped wait
**Status:** ✅ Complete

- [x] Modify `src/cli/wait.mjs` so `spine wait` targets the specific batch ID.
- [x] Add `archived`/`superseded` status (exit 2, batch-scoped output).

### Step 1: Update tests
**Status:** 🟡 In Progress

- [ ] Update `tests/cli/wait.test.mjs` to simulate batch archiving under a wait.

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `npm test` passes
- [ ] `npm run coverage:check` ensures ≥77% line coverage

## Discoveries

| Finding | Detail |
| --- | --- |
| PROMPT path typos | PROMPT referenced `src/batch/wait.mjs`, `src/batch/diagnose.mjs`, `tests/batch/wait.test.mjs` — none exist. Real files: `src/cli/wait.mjs`, `src/batch/diagnosis.mjs`, `tests/cli/wait.test.mjs` (confirmed via sibling tasks SP-360/SP-362 which use `src/cli/`). Corrected path refs in Context/File Scope/Contract/Steps + Amendments note so engine contract verify resolves real files. |

## Notes

- `runSpineWait` captures the active `batchId` on the first reconcile that sees a batch; on each poll, if the active batchId differs from the captured one, it exits promptly with `archived` (active→null) or `superseded` (active→different id) status, exit code 2, output strictly scoped to the original batch id (never the new batch's diagnosis). Leaf `readArchivedBatchRecord` reports the archived terminal phase. New `writeStderr` option for the human message. `src/batch/diagnosis.mjs` untouched (fileScopeMustNotChange).
- All 18 pre-existing wait tests still pass; eslint clean on changed files.
