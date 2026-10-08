# Task: SP-807 — `decideQuotaFallback` pure decision

**Created:** 2026-10-03
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Pure domain function with no callers until SP-809; mistakes would allow ping-pong or repeated retries into an exhausted pool, so the truth table is the deliverable.
**Score:** 3/8 — Blast radius: 0, Pattern novelty: 2, Security: 0, Reversibility: 1
**Problem theory:** #329 requires single-hop, sticky, per-task-bounded provider failover. Encoding those rules as a pure function keeps them testable apart from the engine wiring, and keeps the #248 "one pin per release, no thrash" rule enforceable.

## Mission

Partial #329 — Add the pure decision and state helpers for quota fallback.

New module `src/batch/quota-fallback.mjs`:

1. `decideQuotaFallback({ config, fallbackState, classification, taskId, workerBackend, probeExhaustedPools })`:
   - `config` = resolved spine config; reads `agents.quotaFallbackProfile`, `agents.activeProfile`, `agents.worker.model`, `agents.profiles`.
   - `fallbackState` = `state.resilience?.quotaFallback ?? null` (shape from `buildQuotaFallbackState`).
   - `classification` = SP-804 result (or `null`).
   - `probeExhaustedPools` = optional `string[]` of pools a live probe reported exhausted.
   - Returns one of (in this precedence):
     1. `{ action: "none", reason: "disabled" }` — `quotaFallbackProfile` unset/empty.
     2. `{ action: "none", reason: "not_quota" }` — `classification` null or `kind !== "quota_exhausted"` (transient overload never falls back).
     3. `{ action: "none", reason: "backend_unsupported" }` — `workerBackend === "agentSession"` (in-process backend ignores child env).
     4. `{ action: "stop", reason: "profile_missing" }` — profile not in `agents.profiles`.
     5. Fallback already applied (`fallbackState` non-null):
        - task already in `fallbackState.retriedTaskIds` → `{ action: "stop", reason: "task_retry_spent" }`
        - `classification.poolId === fallbackState.exhaustedPool` (a lane that was still on the old pool) → `{ action: "retry", toProfile, toModel }` — no new hop
        - otherwise (the fallback pool is exhausted too) → `{ action: "stop", reason: "fallback_pool_exhausted" }`
     6. `toModel` missing or `inherit` → `{ action: "stop", reason: "fallback_model_unresolved" }`.
     7. `resolvePoolId(toModel) === classification.poolId` → `{ action: "stop", reason: "same_pool" }`.
     8. `probeExhaustedPools` includes the fallback pool → `{ action: "stop", reason: "probe_exhausted" }`.
     9. Else `{ action: "apply", fromProfile, toProfile, fromModel, toModel, exhaustedPool, toPool }`.
   - Every `stop` result also carries `exhaustedPools: string[]` and `resetAtRaw: (string|null)[]` — the original pool/reset from `fallbackState` (when present) plus the current classification's — so callers can report both reset times.
2. `buildQuotaFallbackState(decision, { classification, taskId, now })` → `{ fromProfile, toProfile, fromModel, toModel, exhaustedPool, resetAtRaw, triggerTaskId, at, retriedTaskIds: [] }` (`at` ISO string).
3. `markQuotaFallbackRetry(fallbackState, taskId)` → new state object with `taskId` appended to `retriedTaskIds` (no mutation, no duplicates).
4. Tests `tests/batch/quota-fallback.test.mjs` — one case per precedence row above, plus: z.ai → Kimi apply carries correct models/pools; Kimi → z.ai mirror; `markQuotaFallbackRetry` idempotent; inputs are not mutated.

## Dependencies

- **Task:** SP-804 (classification result shape)

## Context to Read First

- GitHub #329 (Proposed solution §4, Alternatives — no ordered list, no escalatePolicy reuse)
- `src/batch/provider-quota.mjs` (SP-804)
- `src/metrics/quota-snapshot.mjs` `resolvePoolId`
- `.spine/spine-config.json` `agents.profiles` (read-only) — `hard` = `zai/glm-5.3`, `allegretto` = `kimi-coding/k3`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/quota-fallback.mjs`
- `tests/batch/quota-fallback.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/quota-fallback.test.mjs tests/batch/provider-quota.test.mjs` |
| fileScopeMustChange | `src/batch/quota-fallback.mjs`, `tests/batch/quota-fallback.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read SP-804 result shape and `resolvePoolId`
- [ ] Dependencies satisfied

### Step 1: Decision + state helpers

- [ ] `decideQuotaFallback` with the documented precedence
- [ ] `buildQuotaFallbackState`, `markQuotaFallbackRetry`

**Artifacts:**
- `src/batch/quota-fallback.mjs` (new)

### Step 2: Truth-table tests

- [ ] One test per precedence row
- [ ] Apply in both directions; helpers pure

**Artifacts:**
- `tests/batch/quota-fallback.test.mjs` (new)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Coverage gate: `npm run coverage:check` (≥77% line coverage)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (SP-811)

**Check If Affected:**
- None

## Completion Criteria

- [ ] At most one hop per batch; sticky once applied; one auto-retry per task
- [ ] Transient overload, unset key and agentSession never fall back
- [ ] Same-pool and probe-exhausted fallbacks refused

## Git Commit Convention

- `feat(SP-807): decideQuotaFallback single-hop decision (#329)`

## Do NOT

- Perform I/O (no state reads/writes, no journal, no probes) in this module
- Reuse or read `agents.escalatePolicy`
- Support an ordered list of fallback profiles
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
