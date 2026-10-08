# Task: SP-804 — Provider quota error classifier

**Created:** 2026-10-03
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** New pure module; no callers until SP-806. A wrong match would later turn real worker failures into quota failures, so negative cases matter.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1
**Problem theory:** Provider quota exhaustion is 38% of retained `task.failed` events, but every one is recorded as a generic `failed`. Nothing in `src/batch` matches quota, 429 or rate-limit text. The worker runner forwards pi's stderr/stdout on a non-zero exit (`bin/spine-worker-runner.mjs` ~459-467), so the payload ends up in `workerResult.output`.

## Mission

Partial #329 — Add a pure classifier that recognizes provider quota exhaustion and transient overload in worker output.

1. New module `src/batch/provider-quota.mjs` exporting `classifyProviderQuotaError(output, model)` → `null` or:
   `{ kind: "quota_exhausted" | "transient_overload", poolId, httpStatus, providerCode, resetAtRaw, resetAt, message }`.
   - `poolId` from `resolvePoolId(model)` (`src/metrics/quota-snapshot.mjs`).
   - `httpStatus` = the 3-digit status preceding the JSON payload (number) or `null`.
   - `providerCode` = z.ai `code` string (`"1308"`, `"1310"`) or the Kimi `error.type` (`"permission_error"`, `"rate_limit_error"`), else `null`.
   - `resetAtRaw` = the timestamp text after "reset at" when present (z.ai), else `null`.
   - `resetAt` is always `null` for now: the z.ai reset text has no timezone (UTC+8 is inferred, not confirmed — #329). Keep `resetAtRaw` only.
   - `message` = the provider message string (truncate to 300 chars).
2. Rules (match on the payload, not the model, but report the model's pool):
   - z.ai `429` with `code` `1308` (5-hour window) or `1310` (weekly/monthly) → `quota_exhausted`.
   - Kimi `403` `permission_error` whose message contains "usage limit" → `quota_exhausted`.
   - Kimi `429` `rate_limit_error` "currently overloaded" → `transient_overload`.
   - Anything else (including other 4xx/5xx, unrelated text, empty/undefined output) → `null`.
   - When multiple payloads appear, classify the **last** one.
3. Tests `tests/batch/provider-quota.test.mjs` with these real fixtures (as they appear in `workerResult.output`):
   - `429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44"}` + model `zai/glm-5.3` → `quota_exhausted`, pool `zai`, code `1308`, `resetAtRaw` `2026-08-30 09:12:44`, `resetAt` `null`.
   - `429: {"code":"1310","message":"Weekly/Monthly Limit Exhausted. Your limit will reset at 2026-10-06 01:01:36"}` + `zai/glm-5.3` → `quota_exhausted`, code `1310`.
   - `403 {"error":{"type":"permission_error","message":"You've reached your usage limit for this billing cycle. Your quota will be refreshed in the next cycle. To continue now, purchase extra usage or upgrade your plan: https://www.kimi.com/code/#pricing"}}` + `kimi-coding/k3` → `quota_exhausted`, pool `kimi-coding`, `resetAtRaw` `null`.
   - `429 {"error":{"type":"rate_limit_error","message":"The engine is currently overloaded, please try again later"},"type":"error"}` + `kimi-coding/k3` → `transient_overload`.
   - Negatives: `stub worker forced failure for SP-1`, a 500 error, a 403 without "usage limit", `""`, `undefined`, unknown model → pool `unknown` but kind still from payload.

## Dependencies

- **None**

## Context to Read First

- GitHub #329 (Proposed solution §2)
- `src/metrics/quota-snapshot.mjs` ~29-50 (`POOL_PREFIXES`, `resolvePoolId`)
- `src/batch/diagnosis-launch-failure.mjs` ~70 — precedent for classifying worker output text

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/provider-quota.mjs`
- `tests/batch/provider-quota.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_SUPPRESS_JOURNAL_ATTACH=1 SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/provider-quota.test.mjs tests/metrics/quota-snapshot.test.mjs` |
| fileScopeMustChange | `src/batch/provider-quota.mjs`, `tests/batch/provider-quota.test.mjs` |

## Steps

### Step 0: Preflight

- [ ] Read `resolvePoolId` and confirm pool ids for `zai/*`, `kimi-coding/*`
- [ ] Confirm `src/batch/provider-quota.mjs` does not exist yet
- [ ] Dependencies satisfied

### Step 1: Classifier

- [ ] `classifyProviderQuotaError(output, model)` implemented, pure, no I/O
- [ ] JSDoc typedef for the result shape (module is type-checked by `tsconfig.batch.json` if included there — follow neighbours)

**Artifacts:**
- `src/batch/provider-quota.mjs` (new)

### Step 2: Tests

- [ ] Four real fixtures classify as specified
- [ ] Negative cases return `null`
- [ ] Last-payload-wins case

**Artifacts:**
- `tests/batch/provider-quota.test.mjs` (new)

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

- [ ] Z.ai 1308/1310 and Kimi 403 billing → `quota_exhausted`; Kimi 429 overloaded → `transient_overload`
- [ ] Unrelated output → `null`
- [ ] `resetAt` stays `null`; `resetAtRaw` preserved

## Git Commit Convention

- `feat(SP-804): provider quota error classifier (#329)`

## Do NOT

- Wire the classifier into any caller (SP-806)
- Parse the reset timestamp into a Date or guess a timezone
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
