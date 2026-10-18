# SP-835: Worker spawn honors per-task `**Profile:**` / `**Thinking:**` — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `runNonMatrixTaskOnLane`, `runWorker`, `appendWorkerAgentModelArgs`, `buildTaskMetricRecord`, `resolveTaskWorkerProfile`
- [ ] Confirm where `runWithQuotaFallback`'s `runOnce` re-enters the worker spawn

### Step 1: Precedence + env
**Status:** ⬜ Not Started

- [ ] `resolveTaskWorkerProfile` handles fallback / retry override / prompt / active profile and thinking
- [ ] Engine passes `extraEnv` per attempt

### Step 2: Child thinking override + journal + metrics
**Status:** ⬜ Not Started

- [ ] `SPINE_WORKER_THINKING_OVERRIDE` honored and validated
- [ ] `task.started` payload and metrics record effective profile/model/thinking
- [ ] `worker.profile_override_ignored` for the agentSession backend

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Precedence table incl. hop on the same pool vs a different pool
- [ ] `appendWorkerAgentModelArgs` with valid / invalid thinking override
- [ ] Stub engine run: task with `**Profile:** gemini4` spawns worker env with `SPINE_AGENT_PROFILE_OVERRIDE=gemini4`; `task.started` shows the effective model
- [ ] Metrics record `profile` and override thinking; old records still parse

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-835-worker-task-profile-override/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
