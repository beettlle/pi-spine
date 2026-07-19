# Task: SP-669 — Parse Matrix section from PROMPT.md and expand in planner

**Created:** 2026-07-19
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Adds a new PROMPT section parser and planner expansion logic. Moderate blast radius (parse-prompt, planner waves/lanes) but no engine behavior change yet. Plan review is appropriate.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #217 — Allow `PROMPT.md` to contain a `## Matrix` table that defines a parameter sweep. The planner must parse the table into a list of parameter rows and expand the task into virtual sub-lanes (e.g., `SP-669[a_shell_a]`). `spine plan` should report these sub-lanes. This task only covers parsing and planner expansion; substitution and execution are SP-670 and SP-671.

## Dependencies

- **Task:** SP-672 (frontmatter parsing must be stable; both tasks touch `parse-prompt.mjs`)

## Context to Read First

- `spine-tasks/CONTEXT.md` — release context and next task ID
- `src/tasks/packet/parse-prompt.mjs` — PROMPT parser
- `src/planner/waves.mjs` — wave assembly
- `src/planner/lanes.mjs` — lane assignment
- `spine-tasks/_explore/matrix-tasks/findings.md` — explore findings

## Environment

- **Workspace:** `src/tasks/packet/`, `src/planner/`
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/planner/waves.mjs`
- `src/planner/lanes.mjs`
- `src/planner/matrix.mjs` (new)
- `tests/planner/matrix-parse.test.mjs`
- `tests/planner/plan-matrix.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && node --test tests/planner/matrix-parse.test.mjs && node --test tests/planner/plan-matrix.test.mjs` |
| fileScopeMustChange | `src/planner/matrix.mjs`, `tests/planner/matrix-parse.test.mjs`, `tests/planner/plan-matrix.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] SP-672 frontmatter parsing is on `main`

### Step 1: Parse `## Matrix` table

- [ ] Add `## Matrix` section recognition to `parse-prompt.mjs`
- [ ] Parse the markdown table into an array of row objects keyed by column headers
- [ ] Expose `matrix` (rows array) and `matrixColumns` in the parsed task object
- [ ] Preserve backward compatibility: tasks without `## Matrix` behave identically

**Artifacts:**
- `src/tasks/packet/parse-prompt.mjs` (modified)
- `src/planner/matrix.mjs` (new, helper for matrix parsing/validation)

### Step 2: Expand matrix tasks into virtual sub-lanes

- [ ] In `src/planner/waves.mjs`, when a task has a `matrix`, generate one virtual sub-task per row
- [ ] Each virtual sub-task ID is `SP-XXX[row_id]` where `row_id` is derived from the row values or a `run_id` column
- [ ] Ensure `spine plan` output lists sub-lanes and respects `lanes.maxParallel`
- [ ] Update `src/planner/lanes.mjs` to assign virtual sub-lanes to lanes while keeping serial dependencies

**Artifacts:**
- `src/planner/waves.mjs` (modified)
- `src/planner/lanes.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Add tests for matrix table parsing (valid table, empty table, malformed table)
- [ ] Add tests for planner expansion (correct number of sub-lanes, parallel lanes, serial deps preserved)
- [ ] Add test that non-matrix tasks are unchanged
- [ ] Run `node --test tests/planner/matrix-parse.test.mjs` and `node --test tests/planner/plan-matrix.test.mjs`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Update `STATUS.md` with discoveries
- [ ] Note any planner-output changes in `STATUS.md` for SP-673

## Documentation Requirements

**Must Update:**
- None (runbook update is SP-673)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-673 will consume notes here

## Completion Criteria

- [x] `## Matrix` table is parsed into row objects
- [x] Tasks with a matrix are expanded into virtual sub-lanes in `spine plan`
- [x] Non-matrix tasks are unchanged
- [x] Planner respects maxParallel and serial dependencies
- [x] All tests pass and coverage is ≥77% on changed code
- [x] STATUS.md updated

## Git Commit Convention

- `feat(SP-669): parse Matrix section from PROMPT.md`
- `feat(SP-669): expand matrix tasks into virtual sub-lanes in planner`
- `test(SP-669): add matrix parse and planner tests`

## Do NOT

- Implement matrix variable substitution or execution (SP-670/SP-671)
- Add per-task model overrides
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

### Amendment 1 — 2026-07-19

**Issue:** Preflight `prelanded-file-scope` — `parse-prompt.mjs` / `waves.mjs` / `lanes.mjs` already changed on `main` (SP-672 wave 0).
**Resolution:** Redirected `fileScopeMustChange` to new deliverables only (`src/planner/matrix.mjs` + matrix test files). File Scope still allows edits to the pre-landed modules.
