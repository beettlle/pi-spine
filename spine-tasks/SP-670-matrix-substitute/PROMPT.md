# Task: SP-670 — Substitute matrix variables in contract and steps

**Created:** 2026-07-19
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Pure substitution helper that applies to parsed task text and contract fields; no engine behavior change. Low blast radius but must integrate with contract verify, so plan review is prudent.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #217 — Replace `{matrix.var}` placeholders inside a matrix task's `## Steps` command blocks and `## Contract` fields with the values from the current matrix row. The substitution must be deterministic, fail loudly on unknown `{matrix.X}` references, and produce the same result for every sub-lane of a matrix task. This task does not execute the sub-lanes; execution is SP-671.

## Dependencies

- **Task:** SP-669 (matrix rows must be parsed and available)

## Context to Read First

- `spine-tasks/CONTEXT.md` — release context and next task ID
- `src/planner/matrix.mjs` — matrix helper created in SP-669
- `src/batch/contract-verify.mjs` — contract verification entry point
- `src/batch/contract-parse.mjs` — contract parser

## Environment

- **Workspace:** `src/planner/`, `src/batch/`
- **Services required:** None

## File Scope

- `src/planner/matrix.mjs`
- `src/batch/contract-verify.mjs`
- `src/batch/contract-parse.mjs`
- `tests/planner/matrix-subst.test.mjs`
- `tests/batch/contract-matrix-subst.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && node --test tests/planner/matrix-subst.test.mjs && node --test tests/batch/contract-matrix-subst.test.mjs` |
| fileScopeMustChange | `src/planner/matrix.mjs`, `tests/planner/matrix-subst.test.mjs`, `tests/batch/contract-matrix-subst.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] SP-669 matrix parsing is on `main`

### Step 1: Implement substitution helper

- [ ] In `src/planner/matrix.mjs`, add a function `substituteMatrixVariables(template, row)`
- [ ] Replace `{matrix.<column>}` with the row value for that column
- [ ] Throw a clear error for unknown column references
- [ ] Support escaping or leave literal when column is missing (fail-closed)

**Artifacts:**
- `src/planner/matrix.mjs` (modified)

### Step 2: Apply substitution to contract and steps

- [ ] In `contract-verify.mjs` or `contract-parse.mjs`, when verifying a matrix sub-lane, substitute the matrix row into `testCommand`, `fileScopeMustChange`, and `artifactsMustExist`
- [ ] In the worker/engine context, substitute matrix row values into the rendered steps text before execution
- [ ] Preserve non-matrix tasks unchanged

**Artifacts:**
- `src/batch/contract-verify.mjs` (modified)
- `src/batch/contract-parse.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Add unit tests for `substituteMatrixVariables` (valid, unknown column, missing braces)
- [ ] Add integration test that a matrix task's `testCommand` is substituted correctly per row
- [ ] Add integration test that `fileScopeMustChange` with `{matrix.run_id}` resolves to the expected path
- [ ] Run targeted tests
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update `STATUS.md` with discoveries
- [ ] Note any substitution syntax decisions for SP-673

## Documentation Requirements

**Must Update:**
- None (runbook update is SP-673)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-673 will consume notes here

## Completion Criteria

- [ ] `{matrix.<column>}` placeholders are substituted per row
- [ ] Unknown column references fail loudly
- [ ] Contract fields and step commands are substituted before execution/verify
- [ ] Non-matrix tasks are unchanged
- [ ] All tests pass and coverage is ≥77% on changed code
- [ ] STATUS.md updated

## Git Commit Convention

- `feat(SP-670): add matrix variable substitution helper`
- `feat(SP-670): apply substitution to contract and steps`
- `test(SP-670): add matrix substitution tests`

## Do NOT

- Implement sub-lane execution (SP-671)
- Add per-task model overrides
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

### Amendment 1 — 2026-07-19

**Issue:** Preflight `prelanded-file-scope` — `contract-verify.mjs` already changed on `main` (SP-668 wave 0).
**Resolution:** Redirected `fileScopeMustChange` to matrix substitution deliverables (`src/planner/matrix.mjs` + subst tests). File Scope still allows edits to contract-verify/parse.
