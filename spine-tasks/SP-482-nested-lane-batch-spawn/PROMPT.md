# Task: SP-482 — Guard against nested batch spawns in lane worktrees

**Created:** 2026-07-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Touches batch engine startup path and worker spawn env; prevents cascading engine corruption that causes state_drift and orphaned processes across all active batches.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2

## Canonical Task Folder

```
spine-tasks/SP-482-nested-lane-batch-spawn/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

Prevent pi workers running inside lane worktrees from spawning nested `spine batch start` commands. Currently, workers (or pi extensions triggered by them) can invoke `spine batch start` inside a lane worktree, creating rogue batch engine processes that corrupt the parent batch's state — causing `state_drift`, `engine_orphaned`, and requiring operator intervention with `pkill`. 

The fix introduces two guards: (1) an env var `SPINE_IS_WORKER=1` set in the worker spawn environment that `startBatch` refuses to proceed with, and (2) a filesystem check that detects when CWD is inside a `.worktrees/spine-*` directory.

**Closes:** [#115](https://github.com/beettlle/pi-spine/issues/115)

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `src/batch/worker-host.mjs` — worker spawn env setup
- `src/batch/engine.mjs` — `startBatch` entry point
- `src/batch/worktree.mjs` — worktree path utilities

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/engine.mjs`
- `tests/batch/nested-spawn-guard.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/nested-spawn-guard.test.mjs && npm run coverage:check` |
| fileScopeMustChange | `src/batch/worker-host.mjs`, `src/batch/engine.mjs` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/nested-spawn-guard.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Required files exist (`src/batch/worker-host.mjs`, `src/batch/engine.mjs`)
- [ ] Understand current worker spawn env vars (SPINE_BATCH_ID, SPINE_JOURNAL_ATTACH)
- [ ] Confirm no existing guard against nested batch starts

### Step 1: Set SPINE_IS_WORKER env in worker spawn

- [ ] In `worker-host.mjs`, add `SPINE_IS_WORKER=1` to the env object passed to the child process spawn
- [ ] Ensure the env var propagates to all child processes of the worker (pi, cursor agents, subprocesses)
- [ ] Run targeted tests: `npm test -- tests/batch/worker-host`

**Artifacts:**
- `src/batch/worker-host.mjs` (modified)

### Step 2: Add nested-spawn guard to startBatch

- [ ] In `engine.mjs` `startBatch`, add an early check: if `process.env.SPINE_IS_WORKER === "1"`, return `{ ok: false, error: "nested_batch_spawn_blocked" }` with a clear headline
- [ ] Add a secondary filesystem check: if CWD matches `.worktrees/spine-*` pattern, refuse to start with same error class
- [ ] Emit a journal warning event `engine.nested_spawn_blocked` with CWD and parent batch ID (from `SPINE_BATCH_ID` env if available)
- [ ] Run targeted tests: `npm test -- tests/batch/engine`

**Artifacts:**
- `src/batch/engine.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage on in-scope changed code
- [ ] Add test: `startBatch` returns error when `SPINE_IS_WORKER=1`
- [ ] Add test: `startBatch` returns error when CWD is inside `.worktrees/spine-*`
- [ ] Add test: normal `startBatch` (no env, normal CWD) still succeeds (regression)
- [ ] Add test: worker spawn env includes `SPINE_IS_WORKER=1`
- [ ] Fix all failures

**Artifacts:**
- `tests/batch/nested-spawn-guard.test.mjs` (new)

### Step 4: Documentation & Delivery

- [ ] Update operator runbook with `nested_batch_spawn_blocked` diagnosis
- [ ] Note in CONTEXT.md if this resolves the #115 recovery pattern

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — add nested_batch_spawn_blocked diagnosis

**Check If Affected:**
- `.spine/agents/worker.md` — mention that workers must not invoke `spine batch start`

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] `spine batch start` inside a lane worktree returns immediate error (no engine process created)
- [ ] Worker spawn env includes `SPINE_IS_WORKER=1`
- [ ] No rogue nested batch processes possible from worker child trees
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat(SP-482): complete Step N — description`
- **Bug fixes:** `fix(SP-482): description`
- **Tests:** `test(SP-482): description`
- **Hydration:** `hydrate: SP-482 expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Change the worker spawn behavior beyond adding the env var

---

## Amendments (Added During Execution)
