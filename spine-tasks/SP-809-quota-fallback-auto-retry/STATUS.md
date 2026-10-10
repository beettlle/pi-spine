# SP-809: In-lane automatic quota retry — Status

**Current Step:** Step 2: Wire normal + resume paths
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-10
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Worktree reset behaviour confirmed
- [x] `engine-lanes.mjs` line count recorded
- [x] Dependencies satisfied

### Step 1: Wrapper
**Status:** ✅ Complete

- [x] Decision handling
- [x] Synchronous apply; single retry

### Step 2: Wire normal + resume paths
**Status:** ⬜ Not Started

- [ ] Normal path (net ≤ 0 lines)
- [ ] Resume path
- [ ] Stub pass-profile hook

### Step 3: Integration tests
**Status:** ⬜ Not Started

- [ ] Fallback succeeds
- [ ] Fallback pool exhausted
- [ ] Parallel lanes
- [ ] Overloaded / unset
- [ ] Partial work; resume; config untouched

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Batch suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact: `runTaskOnLane` — 0 indexed upstream (LOW; sole production caller is `runEngine`, `src/batch/engine.mjs:316`, via the facade re-export). `runNonMatrixTaskOnLane` — module-private, 1 caller (`runTaskOnLane`). `executeResumeWave` — 1 caller `resumeMultiTaskBatch` (`src/batch/resume-multi.mjs:129`). All LOW risk. |
| 2 | Mission §3 confirmed: neither `runNonMatrixTaskOnLane` nor `runResumedTaskOnLane` resets or recreates the worktree on entry — both use `lane.worktreePath` as-is; `ensureLaneSyncedForSharedScopeDeps` only syncs shared-scope deps when configured (fixtures have none) and `recordTaskFailureSalvage` never deletes files. Retry keeps partial work in the same worktree. No Blocker. |
| 3 | `src/batch/engine-lanes.mjs` is at exactly 500 lines (policy cap). Wiring must be net ≤ 0; plan: compact one-line wrapper-options form. `resume-multi-queue.mjs` is 160 lines (not capped). |
| 4 | Dependencies landed: SP-806 (`SPINE_WORKER_STUB_FAIL_OUTPUT` hook + `provider_quota_exhausted`/`providerQuota` in workerResult), SP-807 (`decideQuotaFallback` in `src/batch/quota-fallback.mjs`), SP-808 (`applyQuotaFallback`/`recordQuotaFallbackRetry`/`recordQuotaFallbackExhausted`/`resolveEffectiveWorkerModel` in `engine-lanes/quota-fallback-state.mjs`; sticky override in `worker-host.mjs`; `task.workerModel` preferred in `buildTaskMetricRecord`). |
| 5 | `saveEngineBatchState`/`applyQuotaFallback`/`recordQuotaFallbackRetry` persist synchronously enough for the sticky override: `worker-host` re-reads fallback from disk per spawn (`loadQuotaFallbackForWorker`), so attempt 2 sees the persisted hop via `SPINE_AGENT_PROFILE_OVERRIDE` in child env. |
| 6 | Classifier pool id is model-derived: attempt 2 under fallback model `kimi-coding/k3` with static z.ai `FAIL_OUTPUT` classifies poolId `kimi` → decision is `stop/fallback_pool_exhausted` (not same-pool `retry`), so the exhausted test can use the static output; `resetAtRaw` is extracted from payload text both times. |

## Blockers

_None._
