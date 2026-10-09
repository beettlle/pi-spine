# SP-808: Persist fallback state + sticky worker override — Status

**Current Step:** Step 1: State helpers
**Status:** 🔄 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Impact analysis recorded
- [x] Loader/saver identified
- [x] Dependencies satisfied

### Step 1: State helpers
**Status:** 🔄 In Progress

- [ ] Apply / retry / exhausted helpers
- [ ] Env + effective model helpers

### Step 2: Sticky override + metrics + reconstruct
**Status:** ⬜ Not Started

- [ ] `runWorker` override + effective model
- [ ] Metrics `task.workerModel`
- [ ] Reconstruct keeps fallback

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Helper + journal tests
- [ ] Child env override; collision
- [ ] Metrics; reconstruct

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
| 1 | GitNexus impact: `runWorker` CRITICAL upstream (engine-lanes, matrix-run, resume paths) — change is additive only (env merge + model threading), no signature change. `buildTaskMetricRecord` and `reconstructBatchStateFromRuntime` LOW risk (0 upstream). |
| 2 | Loader for `runWorker`: `loadSpineBatchState` (`src/batch/state-io.mjs`, read-only). Saver for lane paths: `saveEngineBatchState` (`src/batch/pause.mjs`, async, pause-merge) — matches `engine-lanes/matrix-run.mjs`. |
| 3 | Dependencies satisfied: SP-805 (`src/config/env-overrides.mjs` `SPINE_AGENT_PROFILE_OVERRIDE`), SP-806 (`applyProviderQuotaClassification` in worker-host), SP-807 (`src/batch/quota-fallback.mjs`) all on this branch. |
| 4 | Journal rebuild carries `seed.resilience` through (`journal-rebuild-structural.mjs` 237/247), so an archive seed with `resilience.quotaFallback` reaches `priorResilience` in reconstruct. |

## Blockers

_None._
