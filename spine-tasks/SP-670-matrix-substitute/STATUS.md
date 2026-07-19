# SP-670: Substitute matrix variables in contract and steps — Status

**Current Step:** Step 3
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
**Status:** ⬜ Not Started

- [ ] STATUS.md updated
- [ ] Notes captured for SP-673

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-19 | Task staged | PROMPT.md and STATUS.md created |

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
