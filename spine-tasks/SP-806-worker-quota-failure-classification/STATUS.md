# SP-806: Classify worker quota failures — Status

**Current Step:** Step 5: Documentation & Delivery
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
- [x] Consumer sweep recorded
- [x] Dependencies satisfied (`src/batch/provider-quota.mjs` exists; worktree clean at 005287ee)

### Step 1: Classification + journal
**Status:** ✅ Complete

- [x] Reclassification + `providerQuota` (post-finalize in `buildWorkerFailureResult` + final return path of `runWorker`)
- [x] `worker.quota_exhausted` journaled (kind `quota_exhausted` only, when projectRoot+batchId set)

Verification: `npm run typecheck` ✅, eslint on changed files ✅, SP-804 suite 16/16 ✅ (after Discovery 8 typing fix)

### Step 2: Metrics + stub hook
**Status:** ✅ Complete

- [x] `failureKind: "quota"` mapping (`buildTaskMetricRecord`, both new exit reasons)
- [x] `SPINE_WORKER_STUB_FAIL_OUTPUT` printed to stderr before the forced-failure line

Verification: node --check, eslint, `npm run typecheck` ✅

### Step 3: Tests
**Status:** ✅ Complete

- [x] z.ai 1308 stub batch → exitReason `provider_quota_exhausted`, journal `worker.quota_exhausted` (providerCode 1308, poolId zai, model journaled), metrics `failureKind: "quota"`, doctor signal fires
- [x] Overloaded → `provider_overloaded`, no journal event, metrics failureKind quota
- [x] Plain forced failure unchanged (`failed`, no providerQuota, no failureKind)

Verification: `node --test tests/batch/worker-quota-classification.test.mjs tests/batch/run-metrics.test.mjs` → 22 pass / 0 fail (with SPINE_IS_WORKER/SPINE_WORKER_RUNNER unset, SPINE_WORKER_STUB=1)

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] Lint (`npm run lint` ✅)
- [x] Contract `testCommand` ✅ — 62/62 (run with `SPINE_IS_WORKER`/`SPINE_WORKER_RUNNER` unset per PROMPT Environment; see Discovery 10)
- [x] Batch suite ✅ — 1631/1632; sole failure is the pre-existing flaky timing test `waitForSequenceBatchTerminal hard-caps at maxWaitMs` (fails identically on base commit 005287ee, Discovery 11)
- [x] Coverage gate ✅ — 2809/2809, line coverage 90.11% (≥77%)
- [x] Fix all failures — `batch-loc-policy` 500-LOC cap: consolidated the three SP-806 helpers into one `applyProviderQuotaClassification`, `worker-host.mjs` 575 → 490 LOC (Discovery 9)

### Step 5: Documentation & Delivery
**Status:** 🔄 In Progress

- [x] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | GitNexus impact `runWorker` (upstream): **CRITICAL** rating — 5 direct callers (`runNonMatrixTaskOnLane`, `runMatrixSubLane`, `runReviewPollLoop`, `runResumedTaskOnLane`, executeResumeWave chain), 6 affected processes, depths 1–3. Matches PROMPT Risk note. Mitigation: change is additive — only plain `failed` classifications are reclassified; `aborted`/`stall_timeout`/`launch_failed`/`review_failed` untouched. All lane consumers copy `workerResult.classification` generically. |
| 2 | GitNexus impact `buildTaskMetricRecord` (upstream): LOW — no indexed upstream callers (wrapped by `recordTaskTerminalMetric`). |
| 3 | Consumer sweep: `src/batch/engine-lanes.mjs:323,337,341`, `src/batch/resume-multi-lanes.mjs:316,320`, `src/batch/resume.mjs:256,292`, `src/batch/engine-lanes/review-poll.mjs:407`, `src/batch/engine-lanes/matrix-run.mjs:546` all use `workerResult.classification ?? "worker_failed"` pass-through → new values flow correctly, no edit needed (and lane files are out of scope by Do NOT). |
| 4 | `src/batch/worker-output.mjs:99` (`shouldCaptureWorkerOutput`) matches literal `failed` for output capture — out of File Scope. Reclassification must run AFTER `finalizeWorkerOutput` (which receives the original `failed`) so quota output is still captured/persisted; planned accordingly. |
| 5 | `src/batch/salvage-batch-list.mjs:18` salvage gate is a blocklist (`contract_failed`, `review_exhausted`, …) — new quota exit reasons stay salvageable like plain `failed`; no fix needed. `src/batch/salvage.mjs:261` gates only on `aborted`. |
| 6 | `src/batch/reconcile-diagnosis.mjs:124` matches `task.status === "failed"` (status, not exitReason) — task.status stays `failed`; unaffected. No dashboard matches in sweep. |
| 7 | `buildWorkerChildEnv` (`src/batch/worker-spawn.mjs:66`) spreads `...process.env` → `SPINE_WORKER_STUB_FAIL_OUTPUT` set in the test process reaches the stub runner child without code changes. |
| 8 | **Import-enabling fix outside File Scope:** importing `src/batch/provider-quota.mjs` (required by Mission §1) from `worker-host.mjs` pulls it into the `tsconfig.batch.json` `checkJs` graph for the first time, surfacing latent SP-804 type errors (`resolvePoolId(model)` null arg at :211, `payload.error` access on `object` at :157). Contract `testCommand` runs `npm run typecheck`, so fixed minimally in place: `model ?? undefined` + `Record<string, any>` payload JSDoc types. Behavior unchanged — SP-804 suite (16 tests) passes. |
| 9 | **500-LOC batch module policy:** `bin/spine-cli/verify.mjs` `batch-loc-policy` (checked by `tests/cli/phase23-exit-verify.test.mjs`, run under `coverage:check`) rejected `worker-host.mjs` at 575 LOC. Consolidated the three helpers (`PROVIDER_QUOTA_CLASSIFICATIONS` map, `resolveWorkerQuotaModel`, `classifyProviderQuotaFailure`, `journalWorkerQuotaExhausted`) into a single `applyProviderQuotaClassification` with compact JSDoc → 490 LOC. Behavior identical; quota classification suite + phase23 verify pass. |
| 10 | **Worker env leakage:** with `SPINE_IS_WORKER=1` (worker session env) set, every `startBatch` test fails with "Nested batch start blocked" and the coverage suite reports 51 failures. Per PROMPT Environment, all Step 4 commands ran with `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER` (coverage additionally unsets the other SPINE_* worker vars). With them unset, contract suite 62/62 and coverage 2809/2809. |
| 11 | **Pre-existing flaky timing tests (not caused by SP-806):** `tests/batch/sequence-detached-poll.test.mjs` (`waitForSequenceBatchTerminal` reused-PID + hard-cap) fail under full-suite parallel load (elapsed seconds vs ms budgets) but pass in isolation; verified identical 2 failures on a clean worktree at base commit `005287ee`. `tests/batch/reviewer-artifact-early-honor.test.mjs` hit a 300s timeout once under coverage load, passes in isolation. |
| 12 | `docs/adoption/operator-runbook.md` has no exhaustive exit-reasons table — exit reasons are mentioned narratively (e.g. :1541, :2075 renders `{exitReason}` verbatim, so new values surface correctly). PROMPT defers doc updates to SP-811; no edit made. |

**Plan (Review Level 2):** In `worker-host.mjs`, add `classifyProviderQuotaError` import + two small helpers: (a) reclassify plain `failed` → `provider_quota_exhausted`/`provider_overloaded` and attach `providerQuota`, applied in `buildWorkerFailureResult` after `finalizeWorkerOutput` (keeps capture semantics, see Discovery 4) and in `runWorker`'s final return path; (b) journal `worker.quota_exhausted` when kind is `quota_exhausted` and projectRoot+batchId set. Metrics: `failureKind: "quota"` for the two new exitReasons next to the contract/reviewer mappings. Stub runner: print `SPINE_WORKER_STUB_FAIL_OUTPUT` to stderr before the existing forced-failure line. Tests: new suite driving `startBatch` stub runs + run-metrics mapping extension.

## Blockers

_None._
