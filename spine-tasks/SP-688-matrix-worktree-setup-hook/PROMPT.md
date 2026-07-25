# Task: SP-688 — Run worktreeSetupHook for matrix sub-lanes

**Created:** 2026-07-25
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Reuse existing parent-lane hook on matrix sub-lane provision; touches matrix execution path (HIGH blast radius — keep change minimal).
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Closes #224 — After provisioning each matrix sub-lane worktree, run the same `worktreeSetupHook` used for parent lanes (`runWorktreeSetupHook` from `src/batch/worktree.mjs`) so gitignored toolchains (e.g. `.venv`) exist before `runCommand`.

**Hard requirement:** Hook must run on the production matrix provision path — not a helper that tests call but engine ignores.

## Dependencies

- **None**

## Context to Read First

- `src/batch/engine-lanes/matrix.mjs` — `provisionMatrixSubLaneWorktree`
- `src/batch/engine-lanes/matrix-run.mjs` — `runMatrixSubLane` provision call site
- `src/batch/worktree.mjs` — `runWorktreeSetupHook`
- `src/batch/engine.mjs` — parent-lane hook usage (~L235)
- `tests/batch/matrix-execution.test.mjs`
- GitHub #224

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes/matrix.mjs`
- `src/batch/engine-lanes/matrix-run.mjs`
- `tests/batch/matrix-execution.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/matrix-execution.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/matrix.mjs`, `tests/batch/matrix-execution.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Confirm `provisionMatrixSubLaneWorktree` only does `worktree add` + git path normalize
- [ ] Confirm parent lanes call `runWorktreeSetupHook` with `SPINE_PROJECT_ROOT` / `SPINE_WORKTREE`

### Step 1: Invoke setup hook on matrix sub-lanes

- [ ] After successful sub-lane provision (in `provisionMatrixSubLaneWorktree` and/or immediately in `runMatrixSubLane`), call `runWorktreeSetupHook` with the same config path semantics as parent lanes
- [ ] Pass required env (`projectRoot`, `worktreePath`, config) so hook scripts can link `.venv` / assets
- [ ] Fail closed: surface hook failure on the matrix row (do not silently continue into `runCommand` without hook when configured)

### Step 2: Testing & Verification

- [ ] Regression: when `worktreeSetupHook` is configured, matrix sub-lane worktree has hook marker / symlink / stdout evidence before execute
- [ ] Run contract `testCommand` only (scoped)
- [ ] Fix all failures from the scoped contract command

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (runbook caveat for matrix hooks may be touched by SP-690 / later)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — matrix / worktree setup

## Completion Criteria

- [ ] Matrix sub-lane provision runs `worktreeSetupHook` when configured
- [ ] Regression proves hook effect in sub-lane worktree
- [ ] Parent-lane hook behavior unchanged

## Do NOT

- Rewrite matrix scheduling / first-class row lanes (#228)
- Change default `lanes.maxParallel` semantics (SP-690)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-688): run worktreeSetupHook for matrix sub-lanes (#224)`
