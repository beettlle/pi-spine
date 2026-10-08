# Task: SP-806 — Classify worker quota failures (exitReason, run-metrics, journal)

**Created:** 2026-10-03
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** `runWorker` is the shared worker launch path (5 direct callers, normal and resume lanes). Changing `classification` from `failed` can break consumers that match the literal.
**Score:** 4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** Quota failures surface as `classification: "failed"` from `buildWorkerFailureResult` (`src/batch/worker-host.mjs` 105-144); the lane paths copy it to `task.exitReason` (`engine-lanes.mjs` ~341, `resume-multi-lanes.mjs` ~320) and spread it into `task.failed`. Run-metrics `failureKind` is only `contract` or `reviewer` (`src/batch/metrics.mjs` ~156-157). `detectQuotaRiskSignals` (`src/doctor/quota-risk.mjs` 141-183) looks for `quota`/`429` in `exitReason`/`failureKind` and can never fire. The stub runner's `SPINE_WORKER_STUB_FAIL_TASKS` exits before any custom output is printed (`bin/spine-worker-runner.mjs` ~316-329), so quota output cannot be driven in stub tests today.

## Mission

Partial #329 — Worker failures caused by provider quota are classified and recorded as such everywhere, without touching the lane files at the 500-line cap.

1. **Classify in `runWorker`** (`src/batch/worker-host.mjs`): for every failed result (post-spawn failures via `buildWorkerFailureResult`), call `classifyProviderQuotaError(output, model)` from `src/batch/provider-quota.mjs` (SP-804) with `model = config.agents?.worker?.model`. When it returns:
   - `quota_exhausted` → `classification: "provider_quota_exhausted"`
   - `transient_overload` → `classification: "provider_overloaded"`
   - and attach `providerQuota: <classifier result>` to the returned object.
   Skip when the original classification is `aborted`, a stall, `launch_failed` or `review_failed` — only reclassify plain `failed` exits.
2. **Journal** `worker.quota_exhausted` `{ taskId, poolId, providerCode, httpStatus, resetAtRaw, model }` (with `laneNumber` / `correlationId` when available) from `runWorker` when kind is `quota_exhausted` and `projectRoot` + `batchId` are set. No event for `transient_overload`.
3. **Run-metrics** (`src/batch/metrics.mjs` `buildTaskMetricRecord`): `failureKind: "quota"` when `exitReason` is `provider_quota_exhausted` or `provider_overloaded`.
4. **Stub hook** (`bin/spine-worker-runner.mjs`, `SPINE_WORKER_STUB_FAIL_TASKS` branch): when `SPINE_WORKER_STUB_FAIL_OUTPUT` is set, write it to stderr before the forced `exit 1` (keep the existing `stub worker forced failure for <id>` line after it).
5. **Consumer sweep:** `rg -n '"failed"' src/batch src/dashboard src/doctor | rg -i 'classification|exitReason'` and `rg -n "worker_failed" src`. Any consumer that must treat the new values like `failed` (salvage eligibility, diagnosis, retry hints, dashboard) gets the minimal fix **only if it is in File Scope**; list the rest in STATUS Discoveries with file:line for the operator (post-integrate `release:check` is the net).
6. **Tests** — new `tests/batch/worker-quota-classification.test.mjs`:
   - `startBatch` stub run (pattern: `tests/batch/engine.test.mjs` ~325-364, `skipPreflight`, `initGitRepo`, `writeSmokeTask`) with `SPINE_WORKER_STUB_FAIL_TASKS=<id>` and `SPINE_WORKER_STUB_FAIL_OUTPUT` = the z.ai 1308 payload `429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44"}` → `task.exitReason === "provider_quota_exhausted"`, journal has `worker.quota_exhausted` with `providerCode: "1308"`, run-metrics record has `failureKind: "quota"`, and `detectQuotaRiskSignals` on those metrics lines returns a quota signal.
   - Kimi 429 overloaded payload → `provider_overloaded`, no `worker.quota_exhausted`.
   - Plain forced failure (no output) → classification unchanged (`failed`).
   - Extend `tests/batch/run-metrics.test.mjs` for the `failureKind: "quota"` mapping.

## Dependencies

- **Task:** SP-804 (`classifyProviderQuotaError` must exist)

## Context to Read First

- GitHub #329 (Proposed solution §3)
- `src/batch/provider-quota.mjs` (SP-804)
- `src/batch/worker-host.mjs` 105-144 (`buildWorkerFailureResult`), 164-420 (`runWorker`)
- `src/batch/engine-lanes.mjs` ~312-378 and `src/batch/resume-multi-lanes.mjs` ~309-350 — read-only; they already copy `classification` to `exitReason`
- `src/batch/metrics.mjs` 121-169
- `bin/spine-worker-runner.mjs` ~315-377 (stub branch)
- `src/doctor/quota-risk.mjs` 141-183

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (tests create temp git repos)
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/worker-host.mjs`
- `src/batch/metrics.mjs`
- `bin/spine-worker-runner.mjs`
- `tests/batch/worker-quota-classification.test.mjs`
- `tests/batch/run-metrics.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/worker-quota-classification.test.mjs tests/batch/run-metrics.test.mjs tests/batch/engine.test.mjs tests/batch/worker-spawn-errors.test.mjs tests/batch/stall-output.test.mjs tests/doctor/quota-risk.test.mjs` |
| fileScopeMustChange | `src/batch/worker-host.mjs`, `src/batch/metrics.mjs`, `tests/batch/worker-quota-classification.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `runWorker` and `buildTaskMetricRecord` (record blast radius in Discoveries)
- [ ] Consumer sweep (Mission §5) recorded
- [ ] Dependencies satisfied (`src/batch/provider-quota.mjs` exists)

### Step 1: Classification + journal

- [ ] `runWorker` reclassifies plain `failed` quota exits and attaches `providerQuota`
- [ ] `worker.quota_exhausted` journaled

**Artifacts:**
- `src/batch/worker-host.mjs` (modified)

### Step 2: Metrics + stub hook

- [ ] `failureKind: "quota"` mapping
- [ ] `SPINE_WORKER_STUB_FAIL_OUTPUT` printed on forced failure

**Artifacts:**
- `src/batch/metrics.mjs`, `bin/spine-worker-runner.mjs` (modified)

### Step 3: Tests

- [ ] z.ai 1308 stub batch → exitReason, journal, metrics, doctor signal
- [ ] Overloaded → `provider_overloaded`, no journal event
- [ ] Plain forced failure unchanged

**Artifacts:**
- `tests/batch/worker-quota-classification.test.mjs` (new), `tests/batch/run-metrics.test.mjs` (modified)

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
- `docs/adoption/operator-runbook.md` (exit reasons table)

## Completion Criteria

- [ ] Quota exits → `provider_quota_exhausted`; overload → `provider_overloaded`; others unchanged
- [ ] `worker.quota_exhausted` journaled; run-metrics `failureKind: "quota"`
- [ ] `detectQuotaRiskSignals` fires on the new records without changes to `quota-risk.mjs`

## Git Commit Convention

- `feat(SP-806): classify provider quota worker failures (#329)`

## Do NOT

- Edit `src/batch/engine-lanes.mjs` or `src/batch/resume-multi-lanes.mjs`
- Add fallback, retry or profile switching (SP-807–SP-809)
- Change `src/doctor/quota-risk.mjs` (SP-810)
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
