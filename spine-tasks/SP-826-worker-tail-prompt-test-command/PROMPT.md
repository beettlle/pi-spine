# Task: SP-826 — Worker tail prompt names Contract testCommand and sends worker.md once

**Created:** 2026-10-10
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Every LLM worker (subprocess and agentSession) receives this tail prompt. A wrong option default drops `worker.md` from agentSession workers entirely.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** `buildWorkerTailPrompt` (`src/batch/worker-prompt.mjs` line 73) always says `Follow PROMPT.md, keep STATUS.md current, run npm test.` The packet's Contract `testCommand` is deliberately scoped (#141), so workers also run the full suite (2,877 tests) and carry its output in context on every later turn. Separately, lines 60–61 append `@<worktree>/.spine/agents/worker.md` to the tail, while `buildWorkerPiArgs` (`bin/spine-worker-runner.mjs` ~114–116) already passes the same file through `--append-system-prompt` — subprocess workers receive `worker.md` twice. The agentSession backend (`buildAgentSessionWorkerPrompt`, `src/batch/agent-session-worker.mjs` ~35–54) has no system-prompt append and relies on the `@worker.md` include, so the include must stay on for that path.

## Mission

Closes #335 — Make the worker tail prompt cheaper and consistent with the packet:

1. **Test instruction** (`src/batch/worker-prompt.mjs`): replace `run npm test.` with an instruction to run the Contract `testCommand` from PROMPT.md, and state that the full suite runs at post-integrate `release:check`. Keep the sentence short — it is sent to every worker.
2. **`worker.md` once**: add an `includeAgentInclude` option to `buildWorkerTailPrompt` (default `true`). When `false`, the tail omits the `@…/worker.md` include. `buildWorkerPiArgs` passes `includeAgentInclude: false` (it already appends `worker.md` as a system prompt). `buildAgentSessionWorkerPrompt` keeps the default (`true`) — do not edit it.
3. **Tests**:
   - `tests/batch/worker-prompt.test.mjs`: tail no longer contains `run npm test`; tail mentions the Contract `testCommand`; `includeAgentInclude: false` omits `@…/worker.md`; default still includes it (existing line ~75 assertion keeps passing).
   - `tests/agents/worker-runner.test.mjs`: `buildWorkerPiArgs` output contains the `worker.md` path exactly once (the `--append-system-prompt` value) and the tail (last arg) has no `@…/worker.md`.

## Dependencies

- **None**

## Context to Read First

- GitHub #335
- `src/batch/worker-prompt.mjs` (whole file, 87 lines)
- `bin/spine-worker-runner.mjs` 95–136 (`buildWorkerPiArgs`)
- `src/batch/agent-session-worker.mjs` 35–54 (`buildAgentSessionWorkerPrompt`)
- `tests/batch/worker-prompt.test.mjs`, `tests/agents/worker-runner.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-prompt.mjs`
- `bin/spine-worker-runner.mjs`
- `tests/batch/worker-prompt.test.mjs`
- `tests/agents/worker-runner.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-prompt.test.mjs tests/batch/worker-prompt-rules.test.mjs tests/agents/worker-runner.test.mjs tests/agents/template-drift.test.mjs tests/config/worker-context.test.mjs tests/worker-tools/review-step-tool.test.mjs tests/batch/worker-backend.test.mjs` |
| fileScopeMustChange | `src/batch/worker-prompt.mjs`, `tests/batch/worker-prompt.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildWorkerTailPrompt` and `buildWorkerPiArgs` — record callers in Discoveries
- [ ] `rg -n 'run npm test|worker\.md|includePromptInclude' tests/` — every test asserting tail text or args is in the Contract run (record in Amendments if a file outside File Scope must change)
- [ ] Dependencies satisfied

### Step 1: Tail prompt changes

- [ ] Contract `testCommand` instruction replaces `run npm test`
- [ ] `includeAgentInclude` option (default `true`)
- [ ] `buildWorkerPiArgs` passes `includeAgentInclude: false`; net line change in `bin/spine-worker-runner.mjs` ≤ 0 (file is 497 lines; modules stay ≤ 500)

**Artifacts:**
- `src/batch/worker-prompt.mjs` (modified)
- `bin/spine-worker-runner.mjs` (modified)

### Step 2: Tests

- [ ] Tail text and include cases in `worker-prompt.test.mjs`
- [ ] Single `worker.md` occurrence in `worker-runner.test.mjs`

**Artifacts:**
- `tests/batch/worker-prompt.test.mjs` (modified)
- `tests/agents/worker-runner.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- None

## Completion Criteria

- [ ] Tail prompt contains no `run npm test` and names the Contract `testCommand`
- [ ] Subprocess worker args reference `worker.md` exactly once (system prompt)
- [ ] agentSession worker prompt still includes `@…/worker.md`

## Git Commit Convention

- `fix(SP-826): worker tail names Contract testCommand; worker.md sent once (#335)`

## Do NOT

- Edit `src/batch/agent-session-worker.mjs` or `templates/agents/worker.md`
- Change `-ne` / `shouldWorkerUsePiNoExtensions`, model args, or PROMPT `@` include order
- Run the full suite (`npm test`, `npm run coverage:check`) — post-integrate `release:check` owns it
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
