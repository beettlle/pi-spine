# SP-807: `decideQuotaFallback` pure decision — Status

**Current Step:** Step 3: Testing & Verification
**Status:** 🟨 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Shapes read
- [x] Dependencies satisfied

### Step 1: Decision + state helpers
**Status:** ✅ Complete

- [x] `decideQuotaFallback`
- [x] State helpers

### Step 2: Truth-table tests
**Status:** ✅ Complete

- [x] Precedence rows
- [x] Both directions; purity

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Notes — Step 1 plan (Review Level 1)

- New pure module `src/batch/quota-fallback.mjs`; only import is `resolvePoolId` from `src/metrics/quota-snapshot.mjs`. No I/O, no `escalatePolicy`, single fallback profile.
- `decideQuotaFallback({...})` implements the 9-row precedence exactly as specified:
  1. `none/disabled` — `agents.quotaFallbackProfile` unset/non-string/blank.
  2. `none/not_quota` — classification null or `kind !== "quota_exhausted"` (transient overload never falls back; fires even when a fallback is already applied).
  3. `none/backend_unsupported` — `workerBackend === "agentSession"`.
  4. `stop/profile_missing` — profile absent from `agents.profiles` (hasOwnProperty + object check, mirroring schema).
  5. `fallbackState` non-null (sticky): `stop/task_retry_spent` if `taskId ∈ retriedTaskIds`; `retry { toProfile, toModel }` (from the recorded state, no new hop) if `classification.poolId === fallbackState.exhaustedPool`; else `stop/fallback_pool_exhausted`.
  6. `stop/fallback_model_unresolved` — fallback profile `worker.model` missing or `inherit`.
  7. `stop/same_pool` — `resolvePoolId(toModel) === classification.poolId`.
  8. `stop/probe_exhausted` — `probeExhaustedPools` contains the fallback pool.
  9. `apply { fromProfile, toProfile, fromModel, toModel, exhaustedPool, toPool }` — fromProfile=`agents.activeProfile`, fromModel=`agents.worker.model`, toModel=profile's worker model, toPool=`resolvePoolId(toModel)`.
- Every `stop` carries parallel arrays `exhaustedPools`/`resetAtRaw`: the recorded pool/reset from `fallbackState` (when present) followed by the current classification's, appended verbatim (no dedupe — a same-pool repeat keeps both reset readings; entries stay index-aligned). `none`/`retry`/`apply` results stay minimal per spec.
- `buildQuotaFallbackState(decision, {classification, taskId, now})` → `{fromProfile, toProfile, fromModel, toModel, exhaustedPool, resetAtRaw, triggerTaskId, at, retriedTaskIds: []}`; `resetAtRaw` from classification, `at = new Date(now).toISOString()`.
- `markQuotaFallbackRetry(state, taskId)` → shallow-copied state with `retriedTaskIds` appended (no mutation, dedupe); throws `TypeError` on non-object state (fail loud, no silent `{}`).

## Discoveries

| # | Finding |
|---|---------|
| 1 | SP-805 already ships `agents.quotaFallbackProfile` schema validation (`src/config/spine-config-schema.mjs`), so `profile_missing` is a defensive fail-closed row for config drift, not a normal path. |
| 2 | `resolvePoolId` maps `inherit` and missing models to `"unknown"`; row 6 gates `inherit` explicitly so an unresolved model can never compare equal to a real pool id by accident. |

## Blockers

_None._
