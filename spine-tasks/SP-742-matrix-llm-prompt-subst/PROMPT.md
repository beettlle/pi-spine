# Task: SP-742 — LLM matrix rows get per-row PROMPT substitution

**Created:** 2026-08-30
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Wire existing SP-670 helpers into LLM matrix branch; worker must see row-substituted steps/contract/file-scope.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Mission

Closes #232 — For `Type: llm` (or non-execute) matrix rows, apply `applyMatrixRowToSteps` / contract substitution before `runWorker` so the PROMPT (and file-scope paths) in the row worktree contain row values. Add an e2e/stub test asserting two rows see different substituted content. Narrow operator-runbook §2.4 caveat.

## Dependencies

- **Task:** SP-740

## Context to Read First

- GitHub #232 — LLM matrix prompt substitution incomplete
- `src/batch/engine-lanes/matrix-run.mjs` — LLM branch comment referencing SP-670/SP-673
- `src/planner/matrix.mjs` — `applyMatrixRowToSteps`
- `src/batch/contract-parse.mjs` — `applyMatrixRowToContract`
- `tests/batch/matrix-execution.test.mjs`
- Parent: SP-740 — serialize operator-runbook.md edits

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix-run.mjs`
- `src/planner/matrix.mjs`
- `src/batch/contract-parse.mjs`
- `tests/batch/matrix-execution.test.mjs`
- `tests/planner/matrix-subst.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs tests/planner/matrix-subst.test.mjs tests/batch/contract-matrix-subst.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix-run.mjs`, `tests/batch/matrix-execution.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-740 `.DONE` on main (runbook ownership)
- [ ] Read LLM branch in `matrix-run.mjs` and SP-670 helpers

### Step 1: Wire substitution into LLM rows

- [ ] Before `runWorker`, write/serve row-substituted steps + contract (+ file-scope) into the row worktree PROMPT
- [ ] Fail loud on unknown `{matrix.*}` refs (existing helper behavior)
- [ ] Keep execute+matrix path unchanged / recommended for pure compute

### Step 2: Tests + runbook §2.4

- [ ] Stub/integration: two rows → worker sees distinct substituted content
- [ ] Remove or narrow §2.4 LLM substitution caveat

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] `docs/adoption/operator-runbook.md` — §2.4 LLM matrix caveat
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/adoption/operator-runbook.md` — §2.4 LLM matrix caveat

## Completion Criteria

- [ ] LLM matrix rows receive substituted PROMPT content
- [ ] Two-row stub/integration test passes
- [ ] Runbook §2.4 updated
- [ ] Closes #232
- [ ] `.DONE` created

## Do NOT

- Ban LLM+matrix
- Implement matrix scheduling epic (#225) or per-row retry (#230)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Git Commit Convention

- `feat(SP-742): LLM matrix per-row PROMPT substitution (#232)`
