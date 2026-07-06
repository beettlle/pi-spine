# SP-501: Enable checkJs on batch hot paths — Status

**Current Step:** Step 4
**Status:** 🟢 Complete
**Last Updated:** 2026-07-06
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code
> changes. Workers expand steps when runtime discoveries warrant it.

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Required files and paths exist
- [x] Current typecheck baseline captured (`checkJs: false` — 0 batch errors)
- [x] Dependencies satisfied (SP-500 complete)

---

### Step 1: Enable checkJs and fix tsc errors
**Status:** ✅ Complete

- [x] `checkJs: true` in tsconfig.batch.json
- [x] tsc errors resolved in four hot-path modules
- [x] `@type {any}` on batch-state replaced in scoped modules
- [x] Targeted typecheck passes

---

### Step 2: Extend typecheck-batch regression test
**Status:** ✅ Complete

- [x] Test asserts `checkJs: true`
- [x] Existing hot-path assertions preserved
- [x] Targeted tests pass

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite passing (1733 pass, `SPINE_WORKER_STUB=1 npm test`)
- [x] Coverage gate passes (88.51% line coverage, threshold 77%)
- [x] All failures fixed
- [x] Build passes (`npm run typecheck`)

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] "Must Update" docs modified (none required)
- [x] "Check If Affected" docs reviewed (`docs/adoption/operator-runbook.md` updated)
- [x] Discoveries logged
- [x] GitHub issue #178 closed

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| — | plan | — | skipped | real-pi worker session (engine runs post-.DONE) |

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `checkJs: true` pulls ~1776 transitive errors (SP-262 pattern); 103 dependency modules need `// @ts-nocheck` containment | Applied mechanical `@ts-nocheck` on transitive imports | `src/**/*.mjs` (not hot paths) |
| `ReturnType<typeof createInitialBatchState>` infers `endedAt`/`lastError` as `null` only | Added `SpineBatchState` typedef with widened fields | `src/batch/engine.mjs` |
| Worker session `SPINE_IS_WORKER=1` breaks batch-spawn tests; unset for full suite | Unset env for contract test runs | worker verification |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-05 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-06 | Step 0 | Preflight complete; baseline 0 batch errors with `checkJs: false` |
| 2026-07-06 | Step 1 | `checkJs: true`; hot-path JSDoc fixes; transitive `@ts-nocheck` |
| 2026-07-06 | Step 2 | `typecheck-batch.test.mjs` asserts `checkJs: true` |
| 2026-07-06 | Step 3 | typecheck + 1733 tests + 88.51% coverage |
| 2026-07-06 | Step 4 | runbook note; issue #178 closed; `.DONE` |

---

## Blockers

*None*

---

## Notes

`SpineBatchState` typedef widens `endedAt`/`lastError` from `createInitialBatchState` literal nulls. Heartbeat call sites use `Parameters<typeof …>[0]` instead of `{any}`.
