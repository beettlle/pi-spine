# SP-835: Worker spawn honors per-task `**Profile:**` / `**Thinking:**` — Status

**Current Step:** Step 5
**Status:** ✅ Complete
**Last Updated:** 2026-10-19
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] GitNexus impact on `runNonMatrixTaskOnLane`, `runWorker`, `appendWorkerAgentModelArgs`, `buildTaskMetricRecord`, `resolveTaskWorkerProfile`
- [x] Confirm where `runWithQuotaFallback`'s `runOnce` re-enters the worker spawn

### Step 1: Precedence + env
**Status:** ✅ Complete

- [x] `resolveTaskWorkerProfile` handles fallback / retry override / prompt / active profile and thinking
- [x] Engine passes `extraEnv` per attempt

### Step 2: Child thinking override + journal + metrics
**Status:** ✅ Complete

- [x] `SPINE_WORKER_THINKING_OVERRIDE` honored and validated
- [x] `task.started` payload and metrics record effective profile/model/thinking
- [x] `worker.profile_override_ignored` for the agentSession backend

### Step 3: Tests
**Status:** ✅ Complete

- [x] Precedence table incl. hop on the same pool vs a different pool
- [x] `appendWorkerAgentModelArgs` with valid / invalid thinking override
- [x] Stub engine run: task with `**Profile:** gemini4` spawns worker env with `SPINE_AGENT_PROFILE_OVERRIDE=gemini4`; `task.started` shows the effective model
- [x] Metrics record `profile` and override thinking; old records still parse

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (ends with the stet review)
- [x] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-835-worker-task-profile-override/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `engine-lanes.mjs` (499 counted lines) and `journal.mjs` (500) sit at the 500-LOC cap; new logic went into `prepareWorkerAttempt` in `task-agent-profile.mjs`, and a dangling JSDoc block in `journal.mjs` was dropped to make room | Done | `src/batch/engine-lanes.mjs`, `src/batch/journal.mjs` |
| `runWorker` quota classification (`quotaCtx.workerModel`) still uses `agents.worker.model` / the sticky hop, not the per-task profile's model; a quota failure on a `**Profile:**` pool is attributed to the config-model pool | Follow-up (`worker-host.mjs` out of File Scope) | `src/batch/worker-host.mjs` |
| `runResumedTaskOnLane` (resume path) does not call `prepareWorkerAttempt`, so resumed tasks ignore `**Profile:**` / `**Thinking:**` | Follow-up (out of File Scope) | `src/batch/resume-multi-lanes.mjs` |
| A sticky hop for a pool other than the task's own is now pinned away in the child env (`SPINE_AGENT_PROFILE_OVERRIDE=<resolved profile>`), keeping the journaled profile equal to what the child runs | Done, tested | `task-agent-profile.mjs` |
| Metrics `thinking` now accepts `minimal` / `xhigh` (previously coerced to `high`) | Done | `src/batch/metrics.mjs` |
| Stet finding claiming the child ignores `SPINE_AGENT_PROFILE_OVERRIDE` when PROMPT has a profile (4396a10) is wrong: the child never reads PROMPT; env override is applied in config load | Dismissed false_positive | `src/config/env-overrides.mjs` |
| Stet re-reviews re-surfaced dismissed findings under new ids and repeatedly cited `agent-session-worker.mjs` (only off/low/medium/high) against the subprocess path | Dismissed as stet reviewer noise; not a project defect | n/a |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
| 2026-10-19 | Steps 0-3 implemented | GitNexus impact: `runNonMatrixTaskOnLane` LOW (1 caller), `runWorker` CRITICAL but unchanged, `buildTaskMetricRecord` LOW; `runOnce` re-enters `runNonMatrixTaskOnLane`, so `prepareWorkerAttempt` runs per attempt |
| 2026-10-19 | Contract lint + typecheck + test files | all green (worker env unset) |
| 2026-10-19 | Re-run after engine contract fail | Added journal rationale comment; dismissed 5 noise findings; Contract exit 0, 0 findings |
| 2026-10-19 | Stet (lenient, SP-835) | Several runs; each re-review produced new, mostly noise findings (stale-hunk context, imports that are used, `agent-session-worker` thinking levels). One real nit fixed (test comment). The rest dismissed with evidence; final run: 0 findings, exit 0 |
