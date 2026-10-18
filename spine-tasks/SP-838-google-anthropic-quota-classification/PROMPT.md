# Task: SP-838 — Classify Google and Anthropic quota/overload errors

**Created:** 2026-10-17
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Misclassifying a content failure as quota would trigger a quota fallback hop; missing a real quota error leaves the batch with generic failures and no fallback.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0
**Problem theory:** `classifyProviderQuotaError` (`src/batch/provider-quota.mjs` 199-220) only looks at payloads found by `STATUS_JSON_PATTERN = /\b(\d{3})\b\s*:?\s*\{/g` (42), and `classifyPayload` (144-186) has z.ai and Kimi rules only. Real worker stderr shapes (derived from installed pi-ai / SDK code — pi print mode writes `assistantMsg.errorMessage`):
- **Google** (`@google/genai` `ApiError` → pi-ai `formatProviderError`, no prefix): `{"error":{"code":429,"message":"You exceeded your current quota...","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"34s"}]}}`. Streaming variant: `got status: RESOURCE_EXHAUSTED. {"error":{...}}`. No 3-digit status before `{`, so nothing matches.
- **Anthropic** (`@anthropic-ai/sdk` `APIError.makeMessage` → `${status} ${JSON.stringify(body)}`): `429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed the rate limit for your organization ..."},"request_id":"req_..."}`; `529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},...}`; mid-stream SSE without prefix: `{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}`; billing: `400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. ..."},...}`. Today the 429 Anthropic rule only matches Kimi's "currently overloaded" wording.
`classifyReviewerProviderError` (`src/batch/reviewer-provider-error.mjs` ~98) returns null when the quota classifier matches, otherwise maps 4xx (except 408/429) to `review_provider_error`.

## Mission

Partial #351 — Google and Anthropic quota exhaustion and overload are classified, so `provider_quota_exhausted` triggers `agents.quotaFallbackProfile` and reviewers report provider quota instead of a generic spawn failure.

1. **Bare JSON envelopes** — extend `collectStatusPayloads` (or add a second pass) to also accept a balanced top-level `{"error":{...}}` object with no status prefix when `error.code` is a 3-digit number (use it as `httpStatus`), and `{"type":"error","error":{"type":"overloaded_error"...}}` with no prefix (treat as status 529). Keep "last payload wins".
2. **Google rule** — `error.code === 429 && error.status === "RESOURCE_EXHAUSTED"`: `providerCode: "RESOURCE_EXHAUSTED"`. Read `details[]`: `google.rpc.RetryInfo.retryDelay` (e.g. `"34s"`) and `google.rpc.QuotaFailure.violations[].quotaId`. Classify `transient_overload` when any `quotaId` contains `PerMinute` or `retryDelay` < 120 s; otherwise `quota_exhausted`. Put `retryDelay` into `resetAtRaw` (`"retry in 34s"`).
3. **Anthropic rules** — `error.type === "overloaded_error"` (529 or unprefixed) → `transient_overload`, `providerCode: "overloaded_error"`. `429` + `error.type === "rate_limit_error"` whose message does not contain "currently overloaded" → `transient_overload`, `providerCode: "rate_limit_error"` (Anthropic rate limits are per-minute). `400` + `error.type === "invalid_request_error"` whose message contains "credit balance is too low" → `quota_exhausted`, `providerCode: "credit_balance_too_low"`. Keep the Kimi rules unchanged and ordered first.
4. **Reviewer path** — confirm `classifyReviewerProviderError` now returns null for these cases (quota classifier wins) and that the reviewer spawn failure is classified as provider quota/overload; adjust `src/batch/reviewer-provider-error.mjs` only if a case still falls through to a generic failure.
5. **Fixtures** — build test strings the way production does: Google via `new ApiError({ message: JSON.stringify(body), status: 429 })` from `@google/genai` passed through pi-ai's `formatProviderError(normalizeProviderError(err))` if those are importable from `node_modules/@earendil-works/pi-ai`; otherwise paste the exact output strings above with a comment naming the producing code path. Anthropic strings as above.

## Dependencies

- **None**

## Context to Read First

- GitHub #351 (comment "Google (`google/*`) check")
- `src/batch/provider-quota.mjs` (whole file, 220 lines)
- `src/batch/reviewer-provider-error.mjs` 80-170
- `src/batch/worker-host.mjs` 60-85 (how `kind` maps to `provider_quota_exhausted` / `provider_overloaded`)
- `tests/batch/provider-quota.test.mjs`, `tests/batch/reviewer-provider-error.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` (`qwen/qwen3.8-27b`) for the stet step of the Contract only.
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/batch/provider-quota.mjs`
- `src/batch/reviewer-provider-error.mjs`
- `tests/batch/provider-quota.test.mjs`
- `tests/batch/reviewer-provider-error.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/batch/provider-quota.test.mjs tests/batch/reviewer-provider-error.test.mjs tests/batch/worker-quota-classification.test.mjs tests/batch/quota-fallback.test.mjs && bash scripts/spine-stet-contract-run.sh lenient SP-838` |
| fileScopeMustChange | `src/batch/provider-quota.mjs`, `tests/batch/provider-quota.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] GitNexus impact on `classifyProviderQuotaError`, `collectStatusPayloads`, `classifyReviewerProviderError`
- [ ] Check whether `ApiError` / `formatProviderError` can be imported in tests; record the decision

### Step 1: Envelopes + rules

- [ ] Unprefixed Google / Anthropic envelopes collected
- [ ] Google, Anthropic rules; Kimi and z.ai unchanged

**Artifacts:**
- `src/batch/provider-quota.mjs` (modified)
- `src/batch/reviewer-provider-error.mjs` (modified only if needed)

### Step 2: Tests

- [ ] Google daily quota → `quota_exhausted`; per-minute / short retry → `transient_overload`; streaming `got status:` variant
- [ ] Anthropic 529, unprefixed SSE overload, 429 rate limit → `transient_overload`; credit balance → `quota_exhausted`
- [ ] Reviewer classifier returns null for these; existing z.ai/Kimi cases unchanged
- [ ] A non-quota Google 400 `INVALID_ARGUMENT` stays unclassified

**Artifacts:**
- `tests/batch/provider-quota.test.mjs` (modified)
- `tests/batch/reviewer-provider-error.test.mjs` (modified)

### Step 3: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-838-google-anthropic-quota-classification/.DONE`

**Stet review (Contract):** the Contract ends with `bash scripts/spine-stet-contract-run.sh lenient SP-838`. When it reports active findings, run `stet list`, fix real defects in this task's diff, and dismiss the rest with `stet dismiss <id> <reason>`, citing lint/typecheck/test evidence. If stet itself fails, record a blocker; do not edit `.review/`.

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` (quota fallback section)

## Completion Criteria

- [ ] Google `RESOURCE_EXHAUSTED` and Anthropic quota/overload errors classified from real output shapes
- [ ] Reviewer provider errors for these cases are no longer generic spawn failures

## Git Commit Convention

- `fix(SP-838): classify Google and Anthropic quota/overload errors (#351)`

## Do NOT

- Change quota probes (SP-839)
- Change quota fallback decision logic (SP-843)
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
