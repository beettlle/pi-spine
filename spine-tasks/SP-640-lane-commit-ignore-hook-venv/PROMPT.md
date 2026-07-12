# Task: SP-640 — Lane commit ignore hook .venv

**Created:** 2026-07-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Default ignore patterns + lane commit filter for hook artifacts.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

**Closes:** [#200](https://github.com/beettlle/pi-spine/issues/200)

Worktree setup hooks commonly `ln -s` `.venv` into lane worktrees. Worker completion must **not** stage/commit that symlink onto the task branch (and thus main after integrate). Default `worktreeSetupIgnorePaths` (when unset) must include `.venv` (document for Python consumers). Lane commit filtering must skip hook-only paths unless the task `fileScope` explicitly requires them.

**Source:** [`docs/PRD-v2.6.0-consumer-resume-handoff.md`](../../docs/PRD-v2.6.0-consumer-resume-handoff.md) §6 FR-REL260-06

## Dependencies

- **None**

## Context to Read First

- `src/batch/lane-commit.mjs` — `filterPorcelain`, commit path
- `src/batch/engine-lanes.mjs` — ignorePatterns wiring
- `src/config/spine-config-load.mjs` — `worktreeSetupIgnorePaths`
- `tests/batch/lane-commit.test.mjs`
- GitHub #200

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/lane-commit.mjs`
- `src/batch/engine-lanes.mjs`
- `src/config/spine-config-load.mjs`
- `tests/batch/lane-commit.test.mjs`
- `templates/spine-config.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/lane-commit.test.mjs` |
| fileScopeMustChange | `src/batch/lane-commit.mjs`, `tests/batch/lane-commit.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Trace how `worktreeSetupIgnorePaths` flows into lane commit
- [ ] Confirm untracked `.venv` symlink can be staged today

### Step 1: Default ignore + commit filter

- [ ] Default ignore includes `.venv` when config omits `worktreeSetupIgnorePaths` (or merge defaults)
- [ ] Lane commit skips ignored hook paths; does not fail solely because ignored symlink exists
- [ ] Regression: `.venv` symlink not in commit

### Step 2: Testing & Verification

- [ ] Run contract `testCommand`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update `templates/spine-config.json` default/example for ignore paths if appropriate
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (narrative in SP-641)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-641
- `templates/spine-config.json` — may update defaults in this task

## Completion Criteria

- [ ] Hook `.venv` not committed by lane completion
- [ ] #200 closable

## Do NOT

- Change evidence-command (SP-638/639)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `fix(SP-640): ignore hook .venv on lane commit (#200)`
