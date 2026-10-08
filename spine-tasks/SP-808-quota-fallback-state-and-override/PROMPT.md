# Task: SP-808 — Persist fallback state + sticky worker override + truthful metrics model

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Every worker spawn in a batch reads the new state; a wrong override would silently switch all workers to another provider. State must survive resume and batch-meta reconstruct.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2
**Problem theory:** Switching at spawn already works: the runner reloads config per spawn, and SP-805 makes `SPINE_AGENT_PROFILE_OVERRIDE` select a profile at load. What is missing is (a) a persisted, batch-scoped record of the applied fallback, (b) passing the override to every later worker spawn in the batch, and (c) run-metrics recording the model actually used — `buildTaskMetricRecord` (`src/batch/metrics.mjs` ~122) always reads `config.agents.worker.model` from batch start. `buildWorkerChildEnv` (`src/batch/worker-spawn.mjs` 66-117) applies `extraEnv` last; `runWorker` (`src/batch/worker-host.mjs`) already receives `projectRoot` and `batchId`. `src/batch/engine-lanes.mjs` is at the 500-line cap, so the override must be resolved inside `runWorker`, not at the lane call site. Batch-meta reconstruct rebuilds `resilience` from a fixed key list (`src/batch/batch-meta-reconstruct.mjs` ~312-324).

## Mission

Partial #329 — Persist the applied quota fallback in batch state, apply it to every later worker spawn, and record the real worker model in run-metrics. No retry logic here (SP-809).

1. **State helpers** — new `src/batch/engine-lanes/quota-fallback-state.mjs`:
   - `applyQuotaFallback({ projectRoot, batchId, state, decision, classification, taskId, now })`: sets `state.resilience.quotaFallback = buildQuotaFallbackState(...)` (SP-807), persists with the same saver the lane paths use (`saveEngineBatchState` / `saveSpineBatchState` — follow `engine-lanes` neighbours), and journals `batch.quota_fallback_applied` `{ fromProfile, toProfile, fromModel, toModel, exhaustedPool, resetAtRaw, taskIds: [taskId] }`. Returns the new fallback state.
   - `recordQuotaFallbackRetry({ projectRoot, batchId, state, taskId })`: `markQuotaFallbackRetry` (SP-807) + persist + journal `task.quota_fallback_retry` `{ taskId, toProfile, toModel }`.
   - `recordQuotaFallbackExhausted({ projectRoot, batchId, decision, taskId })`: journals `batch.quota_fallback_exhausted` `{ taskId, reason, exhaustedPools, resetAtRaw }`.
   - `quotaFallbackWorkerEnv(fallbackState)` → `{ SPINE_AGENT_PROFILE_OVERRIDE: toProfile }` or `{}`.
   - `resolveEffectiveWorkerModel(config, fallbackState)` → `config.agents.profiles[toProfile].worker.model` when a fallback is active, else `config.agents.worker.model`.
2. **Sticky override in `runWorker`** (`src/batch/worker-host.mjs`): when `projectRoot` and `batchId` are set, read the batch state **read-only** (existing loader; never write state from `runWorker`) and merge `quotaFallbackWorkerEnv(state.resilience?.quotaFallback)` under the caller's `extraEnv` (caller keys win, e.g. matrix row identity). Use `resolveEffectiveWorkerModel` for the model passed to `classifyProviderQuotaError` (SP-806) and for the `model` field of `worker.quota_exhausted`. Missing/unreadable state → no override (log nothing new; behaviour unchanged).
3. **Truthful metrics** (`src/batch/metrics.mjs` `buildTaskMetricRecord`): `model` = `task.workerModel` when it is a non-empty string, else today's `config.agents.worker.model ?? "inherit"`. (SP-809 sets `task.workerModel`.)
4. **Reconstruct** (`src/batch/batch-meta-reconstruct.mjs` ~312-324): keep `priorResilience.quotaFallback` when present (same style as `forceMergedWaves`).
5. **Tests:**
   - new `tests/batch/quota-fallback-state.test.mjs`: `applyQuotaFallback` sets state + journals once; `recordQuotaFallbackRetry` appends taskId + journals; `recordQuotaFallbackExhausted` journals both reset times; `quotaFallbackWorkerEnv` / `resolveEffectiveWorkerModel` with and without state; `runWorker` (stub mode) passes `SPINE_AGENT_PROFILE_OVERRIDE` to the child when state has a fallback — assert via a stub that records its env (e.g. `SPINE_WORKER_STUB_OUTPUT` is not enough; write `process.env.SPINE_AGENT_PROFILE_OVERRIDE` from a fake launch script, or read the child env the way existing `worker-spawn` tests do); caller `extraEnv` wins on key collision.
   - `tests/batch/run-metrics.test.mjs`: `task.workerModel` preferred over config.
   - `tests/batch/batch-meta-reconstruct.test.mjs`: `resilience.quotaFallback` survives reconstruct.

## Dependencies

- **Task:** SP-805 (`SPINE_AGENT_PROFILE_OVERRIDE` resolves at config load)
- **Task:** SP-806 (`runWorker` quota classification to update)
- **Task:** SP-807 (`buildQuotaFallbackState`, `markQuotaFallbackRetry`)

## Context to Read First

- GitHub #329 (Proposed solution §5, §6)
- `src/batch/quota-fallback.mjs` (SP-807), `src/batch/provider-quota.mjs` (SP-804)
- `src/config/env-overrides.mjs` (SP-805 override)
- `src/batch/worker-host.mjs` `runWorker`; `src/batch/worker-spawn.mjs` 66-117 (`buildWorkerChildEnv`)
- `src/batch/state-io.mjs` (loaders/savers), `src/batch/pause.mjs` (`saveEngineBatchState`)
- `src/batch/metrics.mjs` 121-169; `src/batch/batch-meta-reconstruct.mjs` 300-330
- `src/batch/journal.mjs` 154 (`appendJournalEvent`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests create temp git repos)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/engine-lanes/quota-fallback-state.mjs`
- `src/batch/worker-host.mjs`
- `src/batch/metrics.mjs`
- `src/batch/batch-meta-reconstruct.mjs`
- `tests/batch/quota-fallback-state.test.mjs`
- `tests/batch/run-metrics.test.mjs`
- `tests/batch/batch-meta-reconstruct.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/quota-fallback-state.test.mjs tests/batch/run-metrics.test.mjs tests/batch/batch-meta-reconstruct.test.mjs tests/batch/worker-quota-classification.test.mjs tests/batch/engine.test.mjs tests/batch/worker-spawn-errors.test.mjs` |
| fileScopeMustChange | `src/batch/engine-lanes/quota-fallback-state.mjs`, `src/batch/worker-host.mjs`, `src/batch/metrics.mjs`, `tests/batch/quota-fallback-state.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runWorker`, `buildTaskMetricRecord`, `reconstructBatchStateFromMeta` (or the reconstruct entry point) — record in Discoveries
- [ ] Identify the read-only batch-state loader for `runWorker` and the saver the lane paths use
- [ ] Dependencies satisfied

### Step 1: State helpers

- [ ] `applyQuotaFallback`, `recordQuotaFallbackRetry`, `recordQuotaFallbackExhausted`
- [ ] `quotaFallbackWorkerEnv`, `resolveEffectiveWorkerModel`

**Artifacts:**
- `src/batch/engine-lanes/quota-fallback-state.mjs` (new)

### Step 2: Sticky override + metrics + reconstruct

- [ ] `runWorker` merges the override (caller `extraEnv` wins) and uses the effective model
- [ ] `buildTaskMetricRecord` prefers `task.workerModel`
- [ ] Reconstruct keeps `resilience.quotaFallback`

**Artifacts:**
- `src/batch/worker-host.mjs`, `src/batch/metrics.mjs`, `src/batch/batch-meta-reconstruct.mjs` (modified)

### Step 3: Tests

- [ ] State helper + journal tests
- [ ] Override reaches the child env; collision rule
- [ ] Metrics model; reconstruct

**Artifacts:**
- `tests/batch/quota-fallback-state.test.mjs` (new); `tests/batch/run-metrics.test.mjs`, `tests/batch/batch-meta-reconstruct.test.mjs` (modified)

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

- [ ] `state.resilience.quotaFallback` persisted, journaled once, survives resume and reconstruct
- [ ] Every worker spawn after apply gets `SPINE_AGENT_PROFILE_OVERRIDE`
- [ ] run-metrics records `task.workerModel` when set
- [ ] `.spine/spine-config.json` never written

## Git Commit Convention

- `feat(SP-808): persist quota fallback + sticky worker profile override (#329)`

## Do NOT

- Edit `src/batch/engine-lanes.mjs`, `src/batch/resume-multi-lanes.mjs` or `src/batch/resume-multi-queue.mjs` (SP-809)
- Trigger retries or call `decideQuotaFallback` from the lane paths (SP-809)
- Write batch state from `runWorker`
- Apply the override to reviewer or supervisor spawns
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
