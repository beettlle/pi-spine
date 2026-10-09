import assert from "node:assert/strict";
import test from "node:test";

import { classifyProviderQuotaError } from "../../src/batch/provider-quota.mjs";

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
