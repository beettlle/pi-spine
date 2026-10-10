# SP-809: In-lane automatic quota retry — Status

**Current Step:** Step 5: Documentation & Delivery
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
**Status:** ✅ Complete

- [x] Normal path (net ≤ 0 lines)
- [x] Resume path
- [x] Stub pass-profile hook

### Step 3: Integration tests
**Status:** ✅ Complete

- [x] Fallback succeeds
- [x] Fallback pool exhausted
- [x] Parallel lanes
- [x] Overloaded / unset
- [x] Partial work; resume; config untouched

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`npm run lint` clean)
- [x] Contract `testCommand` (61/61 pass)
- [x] Batch suite (`test:batch` 1681/1681 pass)
- [x] Coverage gate (`coverage:check` 2859/2859, line coverage 90.42% ≥ 77%)
- [x] Fix all failures (2 typecheck errors in the Step-1 wrapper fixed; pre-existing load flake documented, see Discovery 8)

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
| 6 | Classifier pool id is model-derived: attempt 2 under fallback model `kimi-coding/k3` with static z.ai `FAIL_OUTPUT` classifies poolId `kimi-coding` → decision is `stop/task_retry_spent` (task already in `retriedTaskIds`), so the exhausted test uses the static output; the exhausted event still carries both `resetAtRaw` values (state + classification). |
| 7 | Lane commits merge into the orch branch, not the `main` checkout: after a completed batch the partial-work file lives in the lane worktree and lane branch (`task/spine-lane-*`), not at `projectRoot`. The partial-work test asserts on the lane worktree + `git cat-file <laneBranch>:<path>`. |
| 8 | `tests/batch/sequence-detached-poll.test.mjs` (SP-802) wall-clock timing assertions (`elapsed < 2000ms` around a 300ms cap) are load-sensitive: under load avg 33-51 they failed identically on this branch AND on a clean detached `main` worktree (elapsed ~4s on both), and pass in isolation (10/10) and on a quiet full re-run (2859/2859). Pre-existing flake, unrelated to the SP-809 diff (sequence-wait.mjs not touched). No action taken (file outside scope). |
| 9 | Step-1 wrapper needed two typecheck fixes (implicit `any` in `find` callback; null-guard before `applyQuotaFallback`, whose `classification` param is non-nullable). The guard is behavior-equivalent: `decideQuotaFallback` would answer `none/not_quota` for a null classification. |

## Blockers

_None._
