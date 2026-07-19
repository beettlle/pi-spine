# Task: SP-671 — Execute matrix sub-lanes in parallel worktrees

**Created:** 2026-07-19
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Engine change to run virtual matrix sub-lanes in parallel worktrees, track per-sub-lane status, and aggregate results. High blast radius (engine, lane management, journal) but constrained by prior SP-670 substitution. Plan review is appropriate; Level 2 could be justified if cross-model reviewer is available.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #217 — The engine must execute each matrix row as an independent sub-lane in its own worktree, run the substituted command (or LLM worker, or execution-only command), verify the contract per row, and report the overall task outcome. A single matrix task fails only if any sub-lane fails. Success/failure of each sub-lane must be observable in `spine status` without creating separate `SP-*` folders.

## Dependencies

- **Task:** SP-670 (matrix substitution must be available)
- **Task:** SP-672 (execution-only runner must be available; used for pure compute sub-lanes)

## Context to Read First

- `spine-tasks/CONTEXT.md` — release context and next task ID
- `src/batch/engine.mjs` — task execution orchestration
- `src/batch/engine-lanes.mjs` — lane provisioning and management
- `src/batch/worker-spawn.mjs` — worker spawn (SP-672)
- `src/planner/matrix.mjs` — matrix helper (SP-669/SP-670)
- `spine-tasks/_explore/matrix-tasks/findings.md` — explore findings

## Environment

- **Workspace:** `src/batch/`
- **Services required:** None

## File Scope

- `src/batch/engine.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/journal.mjs`
- `src/batch/lane-commit.mjs`
- `tests/batch/matrix-execution.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && node --test tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `src/batch/engine.mjs`, `src/batch/engine-lanes.mjs`, `src/batch/journal.mjs`, `src/batch/lane-commit.mjs`, `tests/batch/matrix-execution.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] SP-670 and SP-672 are on `main`

### Step 1: Provision worktree per matrix row

- [ ] In `engine-lanes.mjs`, add a path to create a worktree for each matrix sub-lane when a task has a matrix
- [ ] Name worktrees deterministically from the sub-lane ID (e.g., `lane-1-sp-669-a_shell_a`)
- [ ] Reuse existing worktree setup and cleanup

**Artifacts:**
- `src/batch/engine-lanes.mjs` (modified)

### Step 2: Run sub-lanes in parallel up to maxParallel

- [ ] In `engine.mjs`, schedule each matrix row as a sub-lane within the same task
- [ ] Respect `lanes.maxParallel` across all active sub-lanes
- [ ] For each sub-lane, run the substituted command (worker or execution-only based on task type)
- [ ] Track per-row status independently

**Artifacts:**
- `src/batch/engine.mjs` (modified)

### Step 3: Aggregate sub-lane outcomes

- [ ] Mark the parent matrix task as terminal-success only if all sub-lanes succeed
- [ ] Mark the parent task as terminal-failure if any sub-lane fails, and surface which row failed
- [ ] Write per-row status to the journal or a nested state file inside the task folder
- [ ] Ensure `spine status` shows the aggregated state and per-row detail

**Artifacts:**
- `src/batch/journal.mjs` (modified)
- `src/batch/lane-commit.mjs` (modified, if commit scope per row is needed)

### Step 4: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Add end-to-end test with a matrix task that runs two rows and produces two output files
- [ ] Add test that a failing row fails the whole matrix task
- [ ] Add test that maxParallel limits concurrent sub-lanes
- [ ] Run `node --test tests/batch/matrix-execution.test.mjs`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Update `STATUS.md` with discoveries
- [ ] Note any engine/journal changes for SP-673

## Documentation Requirements

**Must Update:**
- None (runbook update is SP-673)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-673 will consume notes here

## Completion Criteria

- [ ] Each matrix row runs in its own worktree sub-lane
- [ ] Sub-lanes respect `lanes.maxParallel`
- [ ] Per-row status is tracked and surfaced
- [ ] Parent task succeeds only if all rows succeed
- [ ] All tests pass and coverage is ≥77% on changed code
- [ ] STATUS.md updated

## Git Commit Convention

- `feat(SP-671): provision worktree per matrix row`
- `feat(SP-671): run matrix sub-lanes in parallel`
- `feat(SP-671): aggregate sub-lane outcomes`
- `test(SP-671): add matrix execution end-to-end tests`

## Do NOT

- Add per-task model overrides
- Implement non-matrix multi-lane changes beyond this scope
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

<!-- Workers add amendments here if issues discovered during execution. -->
