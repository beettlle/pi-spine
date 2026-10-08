# Task: SP-809 — In-lane automatic quota retry (normal + resume) + stub integration

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** First in-engine automatic task retry. Wrong bounds would loop into an exhausted pool or retry real failures; touching the lane dispatch affects every task in every batch.
**Score:** 6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2
**Problem theory:** After a quota failure the lane returns `{ ok: false, workerResult }` and the batch idles until an operator runs `spine batch retry` (14 h in batch `20260928T010710-9c1b`). No engine path calls `resetTaskForRetry` (`src/batch/state.mjs` 235-263; CLI-only today). Dispatch happens in `runTaskOnLane` → `runNonMatrixTaskOnLane` (`src/batch/engine-lanes.mjs` ~163) and on resume in `executeResumeWave` → `runResumedTaskOnLane` (`src/batch/resume-multi-queue.mjs` ~117). Lanes run as async functions in one engine process sharing the in-memory `state`, so a synchronous decide-and-apply section cannot race between lanes. `engine-lanes.mjs` is at the 500-line cap (`split(/\r?\n/).length`).

## Mission

Partial #329 — When a worker fails with `provider_quota_exhausted`, the engine falls back once per batch and retries the task once in the same lane worktree on the fallback profile.

1. **Wrapper** — new `src/batch/engine-lanes/quota-fallback-run.mjs` exporting `runWithQuotaFallback(runOnce, { projectRoot, batchId, state, taskId, config, workerBackend, now })`:
   - Before **each** `runOnce()` call, set the in-memory task's `workerModel = resolveEffectiveWorkerModel(config, state.resilience?.quotaFallback)` (SP-808) so run-metrics are truthful.
   - `result = await runOnce()`. Return it unless `!result.ok && result.workerResult?.classification === "provider_quota_exhausted"`.
   - `decision = decideQuotaFallback({ config, fallbackState: state.resilience?.quotaFallback ?? null, classification: result.workerResult.providerQuota, taskId, workerBackend })` (SP-807). No probe input in this release.
   - `apply` → `applyQuotaFallback(...)`, then retry. `retry` → retry (no new `batch.quota_fallback_applied`). `stop` → `recordQuotaFallbackExhausted(...)` and return the original result. `none` → return the original result (journal unchanged).
   - Retry = `recordQuotaFallbackRetry(...)` + `resetTaskForRetry(state, taskId)` + persist, then `return await runOnce()` **once**. The second result is returned as-is; if it is another quota failure, run the decision once more only to journal `batch.quota_fallback_exhausted` (no further runs).
   - Keep the decide → apply section synchronous (no `await` between reading and writing `state.resilience.quotaFallback`) so parallel lanes produce exactly one `batch.quota_fallback_applied`.
2. **Wire** — `src/batch/engine-lanes.mjs`: wrap the `runNonMatrixTaskOnLane(...)` call in `runTaskOnLane` (~163). **Net line change ≤ 0** (verify with `node -e "console.log(require('fs').readFileSync('src/batch/engine-lanes.mjs','utf8').split(/\r?\n/).length)"` ≤ 500). Matrix tasks are out of scope. `src/batch/resume-multi-queue.mjs`: wrap `runResumedTaskOnLane(...)` the same way.
3. **Same worktree:** confirm the retry reuses the lane worktree without resetting it (partial work kept). If `runNonMatrixTaskOnLane` / `runResumedTaskOnLane` resets or recreates the worktree on entry, stop and record a Blocker instead of widening scope.
4. **Stub hook** (`bin/spine-worker-runner.mjs`, forced-failure branch): when `SPINE_WORKER_STUB_PASS_PROFILE` is set and equals `SPINE_AGENT_PROFILE_OVERRIDE`, skip the forced failure (run the normal stub path).
5. **Integration tests** — new `tests/batch/quota-fallback-integration.test.mjs` (stub batch via `startBatch`, temp repo whose `.spine/spine-config.json` has profiles `hard` = `zai/glm-5.3` (active) and `allegretto` = `kimi-coding/k3`, `agents.quotaFallbackProfile: "allegretto"`):
   - z.ai 1308 output (`SPINE_WORKER_STUB_FAIL_OUTPUT`) + `SPINE_WORKER_STUB_PASS_PROFILE=allegretto` → task succeeds; exactly one `batch.quota_fallback_applied`; `state.resilience.quotaFallback.toProfile === "allegretto"`; run-metrics has a failed record with `model: zai/glm-5.3` and a success record with `model: kimi-coding/k3`.
   - Fallback pool also exhausted (no PASS_PROFILE; output stays z.ai 1308 for attempt 1 — use a Kimi 403 for attempt 2 if you can drive per-attempt output, otherwise assert on the second z.ai failure) → task failed `provider_quota_exhausted`, one `batch.quota_fallback_exhausted` carrying both `resetAtRaw` values (when available), no second `batch.quota_fallback_applied`, no third run.
   - Two parallel tasks failing on the same pool → one `batch.quota_fallback_applied`, two `task.quota_fallback_retry`, both succeed.
   - Kimi 429 overloaded → no fallback events, task failed `provider_overloaded`.
   - `agents.quotaFallbackProfile` unset → journal event types identical to the pre-change flow for a quota failure (no `batch.quota_fallback_*`, no retry).
   - Partial work: with `SPINE_WORKER_STUB_DIRTY_FILE`, the file written on attempt 1 is still present when attempt 2 runs.
   - Resume: after a fallback is applied and the batch is paused/failed, `spine batch retry` + resume keeps `state.resilience.quotaFallback` and the resumed worker receives `SPINE_AGENT_PROFILE_OVERRIDE`.
   - `.spine/spine-config.json` bytes are unchanged after every case.

## Dependencies

- **Task:** SP-806 (`provider_quota_exhausted` + `providerQuota`, stub `SPINE_WORKER_STUB_FAIL_OUTPUT`)
- **Task:** SP-808 (state helpers, sticky override, `task.workerModel` in metrics)

## Context to Read First

- GitHub #329 (Proposed solution §6, Acceptance criteria)
- `src/batch/quota-fallback.mjs` (SP-807), `src/batch/engine-lanes/quota-fallback-state.mjs` (SP-808)
- `src/batch/engine-lanes.mjs` ~140-200 (`runTaskOnLane`), ~197-378 (`runNonMatrixTaskOnLane`)
- `src/batch/resume-multi-queue.mjs` 27-159; `src/batch/resume-multi-lanes.mjs` ~250-350
- `src/batch/state.mjs` 214-263 (`resetTaskForRetry`)
- `tests/batch/engine.test.mjs` ~325-364, `tests/batch/integration-abc.test.mjs` ~141-186 (stub batch patterns)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests create temp git repos)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/quota-fallback-run.mjs`
- `src/batch/engine-lanes.mjs`
- `src/batch/resume-multi-queue.mjs`
- `bin/spine-worker-runner.mjs`
- `tests/batch/quota-fallback-integration.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/quota-fallback-integration.test.mjs tests/batch/quota-fallback-state.test.mjs tests/batch/worker-quota-classification.test.mjs tests/batch/engine.test.mjs tests/batch/integration-abc.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/config/loc-capstone-readiness.test.mjs tests/arch/import-cycles.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/quota-fallback-run.mjs`, `src/batch/engine-lanes.mjs`, `tests/batch/quota-fallback-integration.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runTaskOnLane`, `runNonMatrixTaskOnLane`, `executeResumeWave` — record in Discoveries
- [ ] Confirm whether lane entry resets the worktree (Mission §3)
- [ ] `engine-lanes.mjs` current line count recorded
- [ ] Dependencies satisfied

### Step 1: Wrapper

- [ ] `runWithQuotaFallback` with apply / retry / stop / none handling
- [ ] Synchronous decide → apply section; one retry per call

**Artifacts:**
- `src/batch/engine-lanes/quota-fallback-run.mjs` (new)

### Step 2: Wire normal + resume paths

- [ ] `runTaskOnLane` wraps the non-matrix call (net ≤ 0 lines; ≤ 500 by policy count)
- [ ] `executeResumeWave` wraps `runResumedTaskOnLane`
- [ ] Stub `SPINE_WORKER_STUB_PASS_PROFILE` hook

**Artifacts:**
- `src/batch/engine-lanes.mjs`, `src/batch/resume-multi-queue.mjs`, `bin/spine-worker-runner.mjs` (modified)

### Step 3: Integration tests

- [ ] Fallback succeeds; one applied event; truthful metrics
- [ ] Fallback pool exhausted → stop, no further hop
- [ ] Parallel lanes → one applied event
- [ ] Overloaded / unset → no fallback
- [ ] Partial work kept; resume keeps fallback; config untouched

**Artifacts:**
- `tests/batch/quota-fallback-integration.test.mjs` (new)

### Step 4: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Run batch suite: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 npm run test:batch`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 5: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- None

## Completion Criteria

- [ ] Stub z.ai 1308 batch falls back once and completes on the fallback profile
- [ ] Second quota failure on the fallback pool stops with `provider_quota_exhausted` and no further hop
- [ ] Parallel lanes → one `batch.quota_fallback_applied`
- [ ] Transient overload and unset key never retry
- [ ] Same lane worktree; `state.resilience.quotaFallback` survives resume

## Git Commit Convention

- `feat(SP-809): automatic single-hop quota fallback retry (#329)`

## Do NOT

- Retry matrix tasks or matrix rows
- Retry any classification other than `provider_quota_exhausted`
- Add backoff, sleep-until-reset, or scheduling
- Grow `src/batch/engine-lanes.mjs` past the cap or add a grandfather entry
- Apply fallback to reviewer or supervisor
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
