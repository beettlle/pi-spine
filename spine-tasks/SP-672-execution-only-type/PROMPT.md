# Task: SP-672 — Execution-only task type in PROMPT frontmatter

**Created:** 2026-07-19
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Introduces a new task type parsed from PROMPT frontmatter and bypasses LLM worker spawn while keeping lane isolation and contract verification. Moderate blast radius (engine spawn path, parser); plan review is sufficient given the fail-closed nature of existing contract verification.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Closes #218 (matrix handled by #217) — Add an `Type: execute` frontmatter field to `PROMPT.md` that signals the task is a pure compute job. When present, the spine engine must run a configured bash command (from the `## Contract` `testCommand` or a new `runCommand` field) directly in the lane worktree without spawning the LLM worker. Lane isolation, worktree setup, maxParallel queueing, and contract verification must remain unchanged. If `Type` is omitted, existing behavior is preserved.

## Dependencies

- **None**

## Context to Read First

- `spine-tasks/CONTEXT.md` — release context and next task ID
- `src/tasks/packet/parse-prompt.mjs` — PROMPT frontmatter and section parser
- `src/batch/worker-spawn.mjs` — worker spawn path
- `src/batch/engine.mjs` — task execution orchestration

## Environment

- **Workspace:** `src/tasks/packet/`, `src/batch/`
- **Services required:** None

## File Scope

- `src/tasks/packet/parse-prompt.mjs`
- `src/batch/worker-spawn.mjs`
- `src/batch/engine.mjs`
- `tests/batch/execution-only.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && node --test tests/batch/execution-only.test.mjs` |
| fileScopeMustChange | `src/tasks/packet/parse-prompt.mjs`, `src/batch/worker-spawn.mjs`, `src/batch/engine.mjs`, `tests/batch/execution-only.test.mjs` |
| minLineCoverage | 77 |

## Steps

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] No active batch running

### Step 1: Parse `Type: execute` frontmatter

- [ ] Identify where frontmatter fields are parsed in `parse-prompt.mjs`
- [ ] Add `Type` to accepted frontmatter keys (default `llm` for existing tasks)
- [ ] Expose `type` in the parsed task object
- [ ] Validate that `execute` tasks have a runnable command in the contract

**Artifacts:**
- `src/tasks/packet/parse-prompt.mjs` (modified)

### Step 2: Add execution-only runner path

- [ ] In `worker-spawn.mjs` or a new helper, add a path that spawns `/bin/sh -c` with the task's run command instead of the LLM worker
- [ ] Reuse existing worktree, env, and heartbeat infrastructure
- [ ] Ensure stdout/stderr streaming and exit-code capture match LLM worker path

**Artifacts:**
- `src/batch/worker-spawn.mjs` (modified) or new helper module

### Step 3: Wire engine to choose runner

- [ ] In `engine.mjs`, branch on `task.type === 'execute'` to call the execution-only runner instead of worker spawn
- [ ] Preserve lane isolation, worktree setup, and maxParallel behavior
- [ ] Ensure execution-only tasks still produce `.DONE` and go through contract verification

**Artifacts:**
- `src/batch/engine.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run `npm run typecheck`
- [ ] Add test fixture with a `Type: execute` PROMPT and a simple shell command
- [ ] Assert execution-only task runs without LLM worker, produces expected output, and passes contract verify
- [ ] Assert existing LLM tasks remain unchanged
- [ ] Run `node --test tests/batch/execution-only.test.mjs`
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Update `STATUS.md` with discoveries
- [ ] Note any runbook-relevant behavior in `STATUS.md` for SP-673

## Documentation Requirements

**Must Update:**
- None (runbook update is SP-673)

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — SP-673 will consume notes here

## Completion Criteria

- [ ] `Type: execute` is parsed from PROMPT frontmatter
- [ ] Execution-only tasks bypass LLM worker and run the configured command directly
- [ ] Existing LLM task behavior is unchanged
- [ ] Lane isolation, contract verify, and `.DONE` semantics remain intact
- [ ] All tests pass and coverage is ≥77% on changed code
- [ ] STATUS.md updated

## Git Commit Convention

- `feat(SP-672): parse Type: execute frontmatter`
- `feat(SP-672): add execution-only runner path`
- `feat(SP-672): wire execution-only into engine`
- `test(SP-672): add execution-only regression tests`

## Do NOT

- Expand task scope into matrix tasks or per-task model overrides
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

<!-- Workers add amendments here if issues discovered during execution. -->
