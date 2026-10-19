import assert from "node:assert/strict";
import test from "node:test";

import { classifyProviderQuotaError, collectStatusPayloads } from "../../src/batch/provider-quota.mjs";

// Real payloads as they land in `workerResult.output` after the worker
// runner forwards pi's stderr/stdout on a non-zero exit (#329).
const ZAI_1308 =
	'429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44"}';
const ZAI_1310 =
	'429: {"code":"1310","message":"Weekly/Monthly Limit Exhausted. Your limit will reset at 2026-10-06 01:01:36"}';
const KIMI_403 =
	'403 {"error":{"type":"permission_error","message":"You\'ve reached your usage limit for this billing cycle. Your quota will be refreshed in the next cycle. To continue now, purchase extra usage or upgrade your plan: https://www.kimi.com/code/#pricing"}}';
const KIMI_429 =
	'429 {"error":{"type":"rate_limit_error","message":"The engine is currently overloaded, please try again later"},"type":"error"}';

test("z.ai 1308 five-hour usage limit classifies as quota_exhausted", () => {
	const result = classifyProviderQuotaError(ZAI_1308, "zai/glm-5.3");
	assert.deepEqual(result, {
		kind: "quota_exhausted",
		poolId: "zai",
		httpStatus: 429,
		providerCode: "1308",
		resetAtRaw: "2026-08-30 09:12:44",
		resetAt: null,
		message: "Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44",
	});
});

test("z.ai 1310 weekly/monthly limit classifies as quota_exhausted", () => {
	const result = classifyProviderQuotaError(ZAI_1310, "zai/glm-5.3");
	assert.deepEqual(result, {
		kind: "quota_exhausted",
		poolId: "zai",
		httpStatus: 429,
		providerCode: "1310",
		resetAtRaw: "2026-10-06 01:01:36",
		resetAt: null,
		message: "Weekly/Monthly Limit Exhausted. Your limit will reset at 2026-10-06 01:01:36",
	});
});

test("Kimi 403 permission_error with usage limit classifies as quota_exhausted", () => {
	const result = classifyProviderQuotaError(KIMI_403, "kimi-coding/k3");
	assert.deepEqual(result, {
		kind: "quota_exhausted",
		poolId: "kimi-coding",
		httpStatus: 403,
		providerCode: "permission_error",
		resetAtRaw: null,
		resetAt: null,
		message:
			"You've reached your usage limit for this billing cycle. Your quota will be refreshed in the next cycle. To continue now, purchase extra usage or upgrade your plan: https://www.kimi.com/code/#pricing",
	});
});

test("Kimi 429 rate_limit_error overload classifies as transient_overload", () => {
	const result = classifyProviderQuotaError(KIMI_429, "kimi-coding/k3");
	assert.deepEqual(result, {
		kind: "transient_overload",
		poolId: "kimi-coding",
		httpStatus: 429,
		providerCode: "rate_limit_error",
		resetAtRaw: null,
		resetAt: null,
		message: "The engine is currently overloaded, please try again later",
	});
});

test("payload embedded in forwarded stderr noise still classifies", () => {
	const output = [
		"× Provider stream failed",
		ZAI_1308,
		"exiting with code 1",
	].join("\n");
	const result = classifyProviderQuotaError(output, "zai/glm-5.3");
	assert.equal(result?.kind, "quota_exhausted");
	assert.equal(result?.poolId, "zai");
	assert.equal(result?.resetAtRaw, "2026-08-30 09:12:44");
});

test("unrelated worker failure text returns null", () => {
	assert.equal(classifyProviderQuotaError("stub worker forced failure for SP-1", "zai/glm-5.3"), null);
});

test("500 server error returns null", () => {
	const output = '500 {"error":{"type":"api_error","message":"Internal server error"}}';
	assert.equal(classifyProviderQuotaError(output, "kimi-coding/k3"), null);
});

test("403 permission_error without usage limit returns null", () => {
	const output = '403 {"error":{"type":"permission_error","message":"Forbidden resource"}}';
	assert.equal(classifyProviderQuotaError(output, "kimi-coding/k3"), null);
});

test("z.ai 429 with unrelated code returns null", () => {
	const output = '429: {"code":"1309","message":"Some other limit"}';
	assert.equal(classifyProviderQuotaError(output, "zai/glm-5.3"), null);
});

test("empty and undefined output return null", () => {
	assert.equal(classifyProviderQuotaError("", "zai/glm-5.3"), null);
	assert.equal(classifyProviderQuotaError(undefined, "zai/glm-5.3"), null);
	assert.equal(classifyProviderQuotaError(null, "zai/glm-5.3"), null);
});

test("unknown model keeps payload classification with unknown pool", () => {
	const result = classifyProviderQuotaError(ZAI_1308, "mystery/model-x");
	assert.equal(result?.kind, "quota_exhausted");
	assert.equal(result?.poolId, "unknown");
	assert.equal(result?.providerCode, "1308");
});

test("missing model still classifies the payload", () => {
	const result = classifyProviderQuotaError(KIMI_429);
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.poolId, "unknown");
});

test("multiple payloads classify the last one", () => {
	const quotaThenOverload = [ZAI_1308, KIMI_429].join("\n");
	const result = classifyProviderQuotaError(quotaThenOverload, "zai/glm-5.3");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.poolId, "zai");
	assert.equal(result?.httpStatus, 429);
	assert.equal(result?.providerCode, "rate_limit_error");
});

test("trailing unmatched payload suppresses earlier quota payload", () => {
	const quotaThen500 = [ZAI_1308, '500 {"error":{"type":"api_error","message":"boom"}}'].join("\n");
	assert.equal(classifyProviderQuotaError(quotaThen500, "zai/glm-5.3"), null);
});

test("malformed JSON payload in output returns null and does not throw", () => {
	// A cut-off stderr line never balances, and a corrupted-but-balanced
	// fragment fails JSON.parse; neither is a provider payload, so the
	// scanner must skip them and return null rather than crash.
	const truncated = '429: {"code":"1308","message":"Usage limit reached for 5 hour. Your li';
	const corrupted = '429: {"code":"1308","message":}';
	assert.equal(classifyProviderQuotaError(truncated, "zai/glm-5.3"), null);
	assert.equal(classifyProviderQuotaError(corrupted, "zai/glm-5.3"), null);
});

test("message longer than 300 characters is truncated", () => {
	const longMessage = "x".repeat(400);
	const output = `429: {"code":"1308","message":"${longMessage} reset at 2026-08-30 09:12:44"}`;
	const result = classifyProviderQuotaError(output, "zai/glm-5.3");
	assert.equal(result?.message.length, 300);
	assert.equal(result?.message, "x".repeat(300));
	// resetAtRaw still reflects the raw provider text, not the truncated message.
	assert.equal(result?.resetAtRaw, "2026-08-30 09:12:44");
});

// --- Google / Anthropic (#351, SP-838) ---------------------------------------
// pi-ai / SDK packages are not installed in this repo, so these are the exact
// strings the producing code paths emit (pi print mode writes
// `assistantMsg.errorMessage`), recorded here rather than generated.

// @google/genai ApiError → pi-ai formatProviderError: bare JSON body, no status prefix.
const googleBody = (extra) =>
	JSON.stringify({
		error: {
			code: 429,
			message: "You exceeded your current quota, please check your plan and billing details.",
			status: "RESOURCE_EXHAUSTED",
			details: extra,
		},
	});
const RETRY_INFO = (delay) => ({ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: delay });
const QUOTA_FAILURE = (quotaId) => ({
	"@type": "type.googleapis.com/google.rpc.QuotaFailure",
	violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId }],
});
const GOOGLE_DAILY = googleBody([QUOTA_FAILURE("GenerateRequestsPerDayPerProjectPerModel-FreeTier"), RETRY_INFO("3600s")]);
const GOOGLE_PER_MINUTE = googleBody([QUOTA_FAILURE("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"), RETRY_INFO("3600s")]);
const GOOGLE_SHORT_RETRY = googleBody([RETRY_INFO("34s")]);
// Streaming variant of the same ApiError text.
const GOOGLE_STREAMING = `got status: RESOURCE_EXHAUSTED. ${GOOGLE_SHORT_RETRY}`;
const GOOGLE_INVALID_ARGUMENT =
	'{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}';

// @anthropic-ai/sdk APIError.makeMessage → `${status} ${JSON.stringify(body)}`.
const ANTHROPIC_529 = '529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CX"}';
// Mid-stream SSE error event: no status prefix.
const ANTHROPIC_SSE_OVERLOADED = '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}';
const ANTHROPIC_429 =
	'429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed the rate limit for your organization (abc) of 50 requests per minute."},"request_id":"req_011CY"}';
const ANTHROPIC_CREDIT =
	'400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CZ"}';

test("Google daily RESOURCE_EXHAUSTED classifies as quota_exhausted with retry hint", () => {
	const result = classifyProviderQuotaError(GOOGLE_DAILY, "google/gemini-2.5-pro");
	assert.equal(result?.kind, "quota_exhausted");
	assert.equal(result?.httpStatus, 429);
	assert.equal(result?.providerCode, "RESOURCE_EXHAUSTED");
	assert.equal(result?.resetAtRaw, "retry in 3600s");
	assert.equal(result?.resetAt, null);
	assert.match(result?.message ?? "", /exceeded your current quota/);
});

test("Google RESOURCE_EXHAUSTED without details is quota_exhausted with null resetAtRaw", () => {
	const result = classifyProviderQuotaError(googleBody([]), "google/gemini-2.5-pro");
	assert.equal(result?.kind, "quota_exhausted");
	assert.equal(result?.resetAtRaw, null);
});

test("Google per-minute quotaId classifies as transient_overload", () => {
	const result = classifyProviderQuotaError(GOOGLE_PER_MINUTE, "google/gemini-2.5-pro");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.providerCode, "RESOURCE_EXHAUSTED");
	assert.equal(result?.resetAtRaw, "retry in 3600s");
});

test("Google retryDelay under 120s classifies as transient_overload; 120s is quota_exhausted", () => {
	const short = classifyProviderQuotaError(GOOGLE_SHORT_RETRY, "google/gemini-2.5-pro");
	assert.equal(short?.kind, "transient_overload");
	assert.equal(short?.resetAtRaw, "retry in 34s");
	const boundary = classifyProviderQuotaError(googleBody([RETRY_INFO("120s")]), "google/gemini-2.5-pro");
	assert.equal(boundary?.kind, "quota_exhausted");
});

test("Google streaming `got status:` variant classifies", () => {
	const result = classifyProviderQuotaError(GOOGLE_STREAMING, "google/gemini-2.5-pro");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.httpStatus, 429);
	assert.equal(result?.resetAtRaw, "retry in 34s");
});

test("Google status-prefixed envelope is not double-collected", () => {
	const result = classifyProviderQuotaError(`429 ${GOOGLE_DAILY}`, "google/gemini-2.5-pro");
	assert.equal(result?.kind, "quota_exhausted");
	assert.equal(collectStatusPayloads(`429 ${GOOGLE_DAILY}`).length, 1);
});

test("Google 400 INVALID_ARGUMENT stays unclassified", () => {
	assert.equal(classifyProviderQuotaError(GOOGLE_INVALID_ARGUMENT, "google/gemini-2.5-pro"), null);
	assert.equal(classifyProviderQuotaError(`got status: INVALID_ARGUMENT. ${GOOGLE_INVALID_ARGUMENT}`, "google/gemini-2.5-pro"), null);
});

test("Google 429 with a different status stays unclassified", () => {
	const output = '{"error":{"code":429,"message":"slow down","status":"UNAVAILABLE"}}';
	assert.equal(classifyProviderQuotaError(output, "google/gemini-2.5-pro"), null);
});

test("Anthropic 529 overloaded_error classifies as transient_overload", () => {
	const result = classifyProviderQuotaError(ANTHROPIC_529, "anthropic/claude-sonnet-4");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.httpStatus, 529);
	assert.equal(result?.providerCode, "overloaded_error");
	assert.equal(result?.message, "Overloaded");
});

test("Anthropic unprefixed SSE overloaded_error is treated as status 529", () => {
	const result = classifyProviderQuotaError(`stream failed\n${ANTHROPIC_SSE_OVERLOADED}\n`, "anthropic/claude-sonnet-4");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.httpStatus, 529);
	assert.equal(result?.providerCode, "overloaded_error");
});

test("Anthropic 429 rate_limit_error classifies as transient_overload", () => {
	const result = classifyProviderQuotaError(ANTHROPIC_429, "anthropic/claude-sonnet-4");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.httpStatus, 429);
	assert.equal(result?.providerCode, "rate_limit_error");
	assert.match(result?.message ?? "", /exceed the rate limit/);
});

test("Anthropic credit balance too low classifies as quota_exhausted", () => {
	const result = classifyProviderQuotaError(ANTHROPIC_CREDIT, "anthropic/claude-sonnet-4");
	assert.equal(result?.kind, "quota_exhausted");
	assert.equal(result?.httpStatus, 400);
	assert.equal(result?.providerCode, "credit_balance_too_low");
});

test("Anthropic 400 invalid_request_error without credit wording stays unclassified", () => {
	const output = '400 {"type":"error","error":{"type":"invalid_request_error","message":"messages: text content blocks must be non-empty"}}';
	assert.equal(classifyProviderQuotaError(output, "anthropic/claude-sonnet-4"), null);
});

test("bare envelopes keep last-payload-wins across prefixed and unprefixed payloads", () => {
	const quotaThenSse = [ZAI_1308, ANTHROPIC_SSE_OVERLOADED].join("\n");
	assert.equal(classifyProviderQuotaError(quotaThenSse, "zai/glm-5.3")?.kind, "transient_overload");
	const sseThenQuota = [ANTHROPIC_SSE_OVERLOADED, ZAI_1308].join("\n");
	assert.equal(classifyProviderQuotaError(sseThenQuota, "zai/glm-5.3")?.kind, "quota_exhausted");
	const quotaThenInvalid = [GOOGLE_DAILY, GOOGLE_INVALID_ARGUMENT].join("\n");
	assert.equal(classifyProviderQuotaError(quotaThenInvalid, "google/gemini-2.5-pro"), null);
});

test("Kimi rules keep precedence over the Anthropic rate_limit_error rule", () => {
	const result = classifyProviderQuotaError(KIMI_429, "kimi-coding/k3");
	assert.equal(result?.kind, "transient_overload");
	assert.equal(result?.message, "The engine is currently overloaded, please try again later");
});
