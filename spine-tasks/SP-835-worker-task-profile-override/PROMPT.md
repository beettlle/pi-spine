# Task: SP-835 — Worker spawn honors per-task `**Profile:**` / `**Thinking:**`

**Created:** 2026-10-17
**Size:** M

## Review Level: 1 (Plan Only)

**Risk:** Changes which model runs each worker. Wrong precedence against quota fallback could send a worker back to an exhausted pool. Review Level stays 1 because engine code review is broken until #343 lands (SP-840).
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** The worker child reloads config (`bin/spine-worker-runner.mjs:452`) and `appendWorkerAgentModelArgs` (73-82) pushes `--model` / `--thinking` from `agents.worker`. `SPINE_AGENT_PROFILE_OVERRIDE` maps to `agents.activeProfile` (`src/config/env-overrides.mjs` 24-28) and is applied before `applyActiveAgentProfile`, so a profile override works through env; a thinking override does not (the profile merge runs after env overrides and would overwrite it). `runNonMatrixTaskOnLane` calls `runWorker` (`src/batch/engine-lanes.mjs` ~285-308) with no `extraEnv`; `resolveWorkerQuotaFallbackContext` (`quota-fallback-state.mjs` 195-202) merges `{ ...fallbackEnv, ...extraEnv }` so caller keys win. `task.started` (~278-283) carries no model info; run-metrics worker rows (`src/batch/metrics.mjs` 121-181) take `thinking` only from `agents.worker.thinking`.

## Mission

Partial #340 — Per-task worker profile and thinking overrides, journaled and recorded in run-metrics. Reviewers are unaffected here (SP-834 already derives the reviewer from the effective worker profile).

1. **Precedence** — extend `resolveTaskWorkerProfile` in `src/batch/engine-lanes/task-agent-profile.mjs` (from SP-834):
   - profile: active quota fallback hop when its `exhaustedPool` equals the pool of the candidate profile's worker model, else `task.profileOverride` (set by `spine batch retry --profile`, SP-836; absent today), else `prompt.profile`, else `agents.activeProfile`;
   - thinking: `prompt.thinking` when set, else the resolved profile's `worker.thinking`, else `agents.worker.thinking`;
   - return `{ profile, model, thinking, source }` where `source` is `quota_fallback` | `retry_override` | `prompt` | `active_profile`.
2. **Worker env** — in `src/batch/engine-lanes.mjs`, compute the context per worker attempt (inside the path `runWithQuotaFallback` re-runs, so a hop applied mid-task is picked up on retry) and pass `extraEnv` to `runWorker`: `SPINE_AGENT_PROFILE_OVERRIDE=<profile>` when the profile differs from `agents.activeProfile`, and `SPINE_WORKER_THINKING_OVERRIDE=<thinking>` when `prompt.thinking` is set.
3. **Thinking override in the child** — `appendWorkerAgentModelArgs` in `bin/spine-worker-runner.mjs` uses `process.env.SPINE_WORKER_THINKING_OVERRIDE` (validated against `off|minimal|low|medium|high|xhigh`; ignore invalid values with a stderr warning) over `agents.worker.thinking`. Pass `env` as an injectable parameter defaulting to `process.env` so tests stay pure.
4. **Journal + metrics** — `task.started` payload gains `workerProfile`, `workerModel`, `workerThinking`, `workerProfileSource`. Store `task.workerProfile` and `task.workerThinking` on the task (next to the existing `task.workerModel` pin from SP-808) and have `buildTaskMetricRecord` (`src/batch/metrics.mjs`) record `profile` and prefer `task.workerThinking` for `thinking`. Keep records backward compatible (optional fields).
5. **Known limit** — the `agentSession` worker backend drops `extraEnv` (`src/batch/worker-spawn.mjs` 446-457; tracked in #317). Log one `worker.profile_override_ignored` journal event when the backend is `agentSession` and an override is present; do not fix the backend here. Register the event in `src/batch/journal.mjs`.

## Dependencies

- **Requires:** SP-833 (parsed `profile` / `thinking`)
- **Requires:** SP-834 (`task-agent-profile.mjs` and `engine-lanes.mjs` edits — same files, serialize)

## Context to Read First

- GitHub #340
- `src/batch/engine-lanes/task-agent-profile.mjs` (SP-834)
- `src/batch/engine-lanes.mjs` 150-310
- `src/batch/engine-lanes/quota-fallback-run.mjs` 50-153; `src/batch/engine-lanes/quota-fallback-state.mjs` 120-205
- `bin/spine-worker-runner.mjs` 60-90, 440-470
- `src/batch/metrics.mjs` 115-200
- `tests/batch/worker-model-pin.test.mjs`, `tests/agents/worker-runner.test.mjs`, `tests/batch/run-metrics.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/task-agent-profile.mjs`
- `src/batch/engine-lanes.mjs`
- `bin/spine-worker-runner.mjs`
- `src/batch/metrics.mjs`
- `src/batch/journal.mjs`
- `tests/batch/task-agent-profile.test.mjs`
- `tests/batch/worker-model-pin.test.mjs`
- `tests/batch/run-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/task-agent-profile.test.mjs tests/batch/worker-model-pin.test.mjs tests/agents/worker-runner.test.mjs tests/batch/run-metrics.test.mjs tests/batch/quota-fallback-integration.test.mjs tests/batch/quota-fallback-state.test.mjs tests/batch/engine.test.mjs tests/arch/import-cycles.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-835` |
| fileScopeMustChange | `src/batch/engine-lanes/task-agent-profile.mjs`, `src/batch/engine-lanes.mjs`, `bin/spine-worker-runner.mjs`, `tests/batch/task-agent-profile.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runNonMatrixTaskOnLane`, `runWorker`, `appendWorkerAgentModelArgs`, `buildTaskMetricRecord`, `resolveTaskWorkerProfile`
- [ ] Confirm where `runWithQuotaFallback`'s `runOnce` re-enters the worker spawn

### Step 1: Precedence + env

- [ ] `resolveTaskWorkerProfile` handles fallback / retry override / prompt / active profile and thinking
- [ ] Engine passes `extraEnv` per attempt

**Artifacts:**
- `src/batch/engine-lanes/task-agent-profile.mjs` (modified)
- `src/batch/engine-lanes.mjs` (modified)

### Step 2: Child thinking override + journal + metrics

- [ ] `SPINE_WORKER_THINKING_OVERRIDE` honored and validated
- [ ] `task.started` payload and metrics record effective profile/model/thinking
- [ ] `worker.profile_override_ignored` for the agentSession backend

**Artifacts:**
- `bin/spine-worker-runner.mjs` (modified)
- `src/batch/metrics.mjs` (modified)
- `src/batch/journal.mjs` (modified)

### Step 3: Tests

- [ ] Precedence table incl. hop on the same pool vs a different pool
- [ ] `appendWorkerAgentModelArgs` with valid / invalid thinking override
- [ ] Stub engine run: task with `**Profile:** gemini4` spawns worker env with `SPINE_AGENT_PROFILE_OVERRIDE=gemini4`; `task.started` shows the effective model
- [ ] Metrics record `profile` and override thinking; old records still parse

**Artifacts:**
- `tests/batch/task-agent-profile.test.mjs` (modified)
- `tests/batch/worker-model-pin.test.mjs` (modified)
- `tests/batch/run-metrics.test.mjs` (modified)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-835-worker-task-profile-override/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-835`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None (runbook escalation docs land with SP-836)

**Check If Affected:**
- `docs/adoption/operator-runbook.md`

## Completion Criteria

- [ ] Worker spawn uses the per-task profile/thinking; quota fallback still wins on the exhausted pool
- [ ] Journal and metrics show the effective worker profile, model and thinking per attempt

## Git Commit Convention

- `feat(SP-835): per-task worker profile and thinking override (#340)`

## Do NOT

- Implement `spine batch retry --profile` or escalation (SP-836)
- Change reviewer resolution (SP-834)
- Fix the agentSession backend env handling (#317)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
