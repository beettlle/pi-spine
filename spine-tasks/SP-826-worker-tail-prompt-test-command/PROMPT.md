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

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-826`, which reviews this task's diff with stet (`.review/config.toml`: `qwen/qwen3.8-27b` on LM Studio with the OpenJev critic). When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>` (`false_positive`, `already_correct`, `wrong_suggestion`, `out_of_scope`), citing lint/typecheck/test evidence. Record stet reviewer bugs (invented syntax errors, stale hunks, parse failures) under Discoveries in STATUS.md. Never dismiss a real defect without fixing it. If stet itself fails (`stet doctor`), record a blocker; do not edit `.review/`.

## Dependencies

- **Task:** SP-828 (stet contract script and review config used by this Contract)
- **Task:** SP-829 (makes `tests/batch/worker-prompt-rules.test.mjs`, which this Contract runs, pass again)

## Context to Read First

- GitHub #335
- `src/batch/worker-prompt.mjs` (whole file, 87 lines)
- `bin/spine-worker-runner.mjs` 95–136 (`buildWorkerPiArgs`)
- `src/batch/agent-session-worker.mjs` 35–54 (`buildAgentSessionWorkerPrompt`)
- `tests/batch/worker-prompt.test.mjs`, `tests/agents/worker-runner.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only (unit tests need neither)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-prompt.mjs`
- `bin/spine-worker-runner.mjs`
- `tests/batch/worker-prompt.test.mjs`
- `tests/agents/worker-runner.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/worker-prompt.test.mjs tests/batch/worker-prompt-rules.test.mjs tests/agents/worker-runner.test.mjs tests/agents/template-drift.test.mjs tests/config/worker-context.test.mjs tests/worker-tools/review-step-tool.test.mjs tests/batch/worker-backend.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-826` |
| fileScopeMustChange | `src/batch/worker-prompt.mjs`, `tests/batch/worker-prompt.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `buildWorkerTailPrompt` and `buildWorkerPiArgs` — record callers in Discoveries
- [ ] `rg -n 'run npm test|worker\.md|includePromptInclude' tests/` — every test asserting tail text or args is in the Contract run (record in Amendments if a file outside File Scope must change)
- [ ] Dependencies satisfied

### Step 1: Tail prompt changes

- [ ] Contract `testCommand` instruction replaces `run npm test`
- [ ] `includeAgentInclude` option (default `true`)
- [ ] `buildWorkerPiArgs` passes `includeAgentInclude: false`; keep `bin/spine-worker-runner.mjs` ≤ 500 lines (497 today; no unrelated edits to save lines)

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
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-826-worker-tail-prompt-test-command/.DONE` (this task folder, not the worktree root)

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

- **2026-10-11 (operator, SP-828 stet adoption):** Contract `testCommand` ends with `bash scripts/spine-stet-contract-run.sh lenient`; added `fileScopeMustNotChange` `.review/**`, the LM Studio and OpenJev services, the stet triage paragraph in Mission, and the dependency on SP-828.
- **2026-10-14 (operator, packet audit):** `bin/spine-worker-runner.mjs` rule is now "≤ 500 lines" instead of "net line change ≤ 0"; no LOC policy covers `bin/`, and the fix needs one line.
- **2026-10-14 (operator, wave 0 follow-up):** Added the dependency on SP-829. After `13ea1975`, two tests in `tests/batch/worker-prompt-rules.test.mjs` fail on `main`, and this Contract runs that file.
- **2026-10-14 (operator, wave 1 stet recovery):** The Contract passes this task's ID to `spine-stet-contract-run.sh`, so stet reviews only this task's commits when another task ran first on the same lane. The lane-commit sanitizer deletes `.review/` session state between serialized tasks.
