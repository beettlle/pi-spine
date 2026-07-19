# SP-670: Substitute matrix variables in contract and steps — Status

**Current Step:** Step 4
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Required files and paths exist
- [x] SP-669 landed on `main` (commits 12079c3b, cc80a657 on `main`; `parseMatrixTable`/`deriveMatrixRowId` present)

---

### Step 1: Implement substitution helper
**Status:** ✅ Complete

- [x] Add `substituteMatrixVariables(template, row)` to `src/planner/matrix.mjs`
- [x] Replace `{matrix.column}` with row value
- [x] Fail loudly on unknown column
- [x] Preserve non-matrix behavior

---

### Step 2: Apply substitution to contract and steps
**Status:** ✅ Complete

- [x] Substitute contract fields per sub-lane (`applyMatrixRowToContract` in `contract-parse.mjs`; `verifyContract` applies `config.matrixRow`)
- [x] Substitute step commands before execution (`applyMatrixRowToSteps` helper in `matrix.mjs`; live worker-context wiring deferred to SP-671 execution)
- [x] Preserve non-matrix tasks (no row → identity return)

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] `npm run typecheck` passes
- [x] Unit tests for substitution helper pass (`tests/planner/matrix-subst.test.mjs`, 12 tests)
- [x] Integration tests for contract substitution pass (`tests/batch/contract-matrix-subst.test.mjs`, 10 tests)
- [x] All failures fixed (scoped verifyContract tests to file-scope substitution)
- [x] Changed-code line coverage 100% (new functions fully covered); lint `--max-warnings 0` clean; no regression in 35 existing matrix/contract tests

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] STATUS.md updated
- [x] Notes captured for SP-673 (substitution syntax decisions below)

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `parseContract` is CRITICAL-risk (18 upstream impacts incl. `runFinalReviewPhase`, `runWorker`). | Added pure additive helpers only; did NOT modify `parseContract`. Substitution is a separate post-parse step. | `src/tasks/packet/parse-prompt.mjs`, `src/batch/contract-parse.mjs` |
| `matrixRow` is attached to the task object only in the planner's in-memory `tasksById` (waves.mjs/lanes.mjs); it does NOT yet flow into the engine verify/worker path. | Delivered substitution *capability* + a backward-compatible `verifyContract` `config.matrixRow` hook. Plumbing `matrixRow` from batch-state into the verify call and writing the substituted PROMPT to the worktree is SP-671 (execution). | `src/planner/waves.mjs`, `src/batch/contract-verify.mjs` |
| PROMPT Step 2 mentions substituting into `artifactsMustExist` but the delivery contract redirected `fileScopeMustChange` deliverables to matrix.mjs (Amendment 1). | Implemented substitution for all string/list contract fields (testCommand, runCommand, fileScopeMustChange, fileScopeMustNotChange, artifactsMustExist) since leaving any un-substituted would be a silent bug; numeric/boolean fields pass through. | `src/batch/contract-parse.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-19 | Preflight | SP-669 on `main`; `parseMatrixTable`/`deriveMatrixRowId` present |
| 2026-07-19 | Step 1 | `substituteMatrixVariables` + `applyMatrixRowToSteps` in matrix.mjs (commit 45d25b50) |
| 2026-07-19 | Step 2 | `applyMatrixRowToContract` in contract-parse.mjs; re-export + `verifyContract` matrixRow hook in contract-verify.mjs (commit 1d14ba4b) |
| 2026-07-19 | Step 3 | 22 tests pass; typecheck clean; lint clean; changed-code coverage 100% (commit 1d6e40e9) |

---

## Blockers

*None*

---

## Notes

*Plan (Review Level 1):* Add pure additive substitution helpers; do NOT modify CRITICAL-risk `parseContract`.
- `substituteMatrixVariables(template, row)` in `src/planner/matrix.mjs` — fail-loud on unknown `{matrix.X}`; unchanged when no row+no placeholders (non-matrix safe).
- `applyMatrixRowToContract(parsedContract, row)` in `src/batch/contract-parse.mjs`, re-exported from `contract-verify.mjs` — substitutes testCommand/runCommand/fileScopeMustChange/fileScopeMustNotChange/artifactsMustExist; returns input unchanged when no row.
- `applyMatrixRowToSteps(steps, row)` in `src/planner/matrix.mjs` for parsed step bodies.
- `verifyContract` gets a backward-compatible `config.matrixRow` hook (additive; no current caller passes it → existing behavior 100% preserved).
- `matrixRow` does not yet flow planner→engine; live worker-context wiring is SP-671 (execution).

### Substitution syntax decisions for SP-673 (runbook)

- **Placeholder syntax:** `{matrix.<column>}` only. `column` matches `[a-zA-Z0-9_-]+` (covers `run_id`, `with-dash`). Other `{...}` groups (e.g. `{env}`) are left literal.
- **Fail-loud (fail-closed):** any `{matrix.X}` whose column is absent from the row throws `Unknown matrix variable reference: {matrix.X}`. A placeholder reaching substitution with **no row at all** also throws — a leftover placeholder never silently reaches execution.
- **Non-matrix tasks:** when no matrix row is supplied, `applyMatrixRowToContract` returns the parsed contract **verbatim** (identity); nothing is substituted.
- **Deterministic:** the same template + row always yields the same result, so every sub-lane of a matrix task produces an identical, reproducible contract.
- **Coverage:** substitution is a **post-parse** step (`applyMatrixRowToContract`), not inside `parseContract`, to keep the critical parser untouched. Contract fields substituted: `testCommand`, `runCommand`, `fileScopeMustChange`, `fileScopeMustNotChange`, `artifactsMustExist`. Numeric/boolean fields (`minLineCoverage`, `stallTimeoutMinutes`, `extendGraceOnFileScope`) pass through unchanged.
- **Execution wiring (SP-671):** SP-671 must (1) thread the matrix row from batch-state into the `verifyContract` call as `config.matrixRow`, and (2) write/serve a substituted PROMPT (steps + contract) to the worker so sub-lanes execute against the right values. `verifyContract` already honors `config.matrixRow`.
