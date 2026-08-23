import assert from "node:assert/strict";
import test from "node:test";

import {
	capPayloadBytes,
	REDACT_KEY_PATTERN,
	redactSecretsDeep,
	redactTextSecrets,
	SECRET_VALUE_PATTERNS,
} from "../../src/util/secret-redact.mjs";

test("redactTextSecrets masks well-known token shapes", () => {
	assert.equal(redactTextSecrets("token sk-live1234567890abcdef here"), "token [REDACTED] here");
	assert.equal(redactTextSecrets("ghp_abcdefghij0123456789"), "[REDACTED]");
	assert.equal(
		redactTextSecrets("github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz0123"),
		"[REDACTED]",
	);
	assert.equal(redactTextSecrets("aws AKIAIOSFODNN7EXAMPLE key"), "aws [REDACTED] key");
	assert.equal(redactTextSecrets("slack xoxb-123456789012-abcdefghij"), "slack [REDACTED]");
});

test("redactTextSecrets masks bearer headers and connection strings", () => {
	assert.equal(
		redactTextSecrets("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload"),
		"Authorization: [REDACTED]",
	);
	assert.equal(
		redactTextSecrets("db=postgres://user:pw@host:5432/app"),
		"db=[REDACTED]",
	);
	assert.equal(redactTextSecrets("DATABASE_URL=mysql://u:p@h/db"), "[REDACTED]");
});

test("redactTextSecrets masks ENV-style assignments whole", () => {
	assert.equal(redactTextSecrets("export GITHUB_TOKEN=ghp_deadbeef"), "export [REDACTED]");
	assert.equal(redactTextSecrets("OPENAI_API_KEY=sk-abc123"), "[REDACTED]");
	assert.equal(redactTextSecrets("MY_SECRET = hunter2"), "[REDACTED]");
});

test("redactTextSecrets masks generic key:value and key=value secrets", () => {
	assert.equal(redactTextSecrets("password: hunter2 ok"), "[REDACTED] ok");
	assert.equal(redactTextSecrets("api_key=abc123"), "[REDACTED]");
	assert.equal(redactTextSecrets("token=tok"), "[REDACTED]");
});

test("redactTextSecrets applies extra caller patterns after builtins", () => {
	const out = redactTextSecrets("leak internal-codename-42 now", [/internal-codename-\d+/g]);
	assert.equal(out, "leak [REDACTED] now");
});

test("redactTextSecrets passes through non-strings and empty input", () => {
	assert.equal(redactTextSecrets(""), "");
	assert.equal(redactTextSecrets(null), null);
	assert.equal(redactTextSecrets(42), 42);
});

test("redactSecretsDeep masks denylisted keys recursively", () => {
	const redacted = redactSecretsDeep({
		apiKey: "secret-value",
		token: "abc",
		nested: { password: "pw", ok: "visible" },
		list: [{ secret: "x" }, "clean"],
	});
	assert.equal(redacted.apiKey, "[REDACTED]");
	assert.equal(redacted.token, "[REDACTED]");
	assert.equal(redacted.nested.password, "[REDACTED]");
	assert.equal(redacted.nested.ok, "visible");
	assert.equal(redacted.list[0].secret, "[REDACTED]");
	assert.equal(redacted.list[1], "clean");
});

test("redactSecretsDeep masks value-shaped secrets under ordinary keys", () => {
	const redacted = redactSecretsDeep({
		output: "failed with sk-live1234567890abcdef in logs",
		environment: "OPENAI_API_KEY=sk-test123456789",
		note: "no secrets here",
	});
	assert.equal(redacted.output, "failed with [REDACTED] in logs");
	assert.equal(redacted.environment, "[REDACTED]");
	assert.equal(redacted.note, "no secrets here");
});

test("redactSecretsDeep honors keyPattern override and allowedKeys", () => {
	const redacted = redactSecretsDeep(
		{ promptText: "secret prompt", tokensIn: 1234, apiToken: "abc123" },
		{
			keyPattern: /key|token|secret|password|prompt/i,
			allowedKeys: new Set(["tokensIn", "tokensOut", "estimatedUsd"]),
		},
	);
	assert.equal(redacted.promptText, "[REDACTED]");
	assert.equal(redacted.apiToken, "[REDACTED]");
	assert.equal(redacted.tokensIn, 1234);
});

test("redactSecretsDeep leaves primitives and empty objects intact", () => {
	assert.equal(redactSecretsDeep(null), null);
	assert.equal(redactSecretsDeep(7), 7);
	assert.equal(redactSecretsDeep(true), true);
	assert.deepEqual(redactSecretsDeep({}), {});
	assert.deepEqual(redactSecretsDeep([]), []);
});

test("capPayloadBytes returns payloads under the byte cap unchanged", () => {
	const payload = { ok: "visible" };
	assert.equal(capPayloadBytes(payload, 1024), payload);
});

test("capPayloadBytes truncates by UTF-8 bytes, not string length", () => {
	const maxBytes = 4096;
	// Each "é" is 2 UTF-8 bytes: 3000 chars = 6000 bytes > maxBytes even
	// though the string length is under the cap.
	const payload = { blob: "é".repeat(3000) };
	assert.ok(JSON.stringify(payload).length < 6000 + 16);
	const capped = capPayloadBytes(payload, maxBytes);
	assert.equal(capped._truncated, true);
	assert.equal(capped._originalBytes, Buffer.byteLength(JSON.stringify(payload), "utf-8"));
	assert.equal(capped._maxBytes, maxBytes);
	assert.ok(capped._originalBytes > maxBytes);
	// Preview is sliced on byte boundaries and stays within the byte budget.
	assert.ok(Buffer.byteLength(capped.preview, "utf-8") <= maxBytes);
});

test("capPayloadBytes preview never emits invalid UTF-8", () => {
	const maxBytes = 1024;
	const payload = { blob: "€".repeat(600) }; // 3 bytes per char
	const capped = capPayloadBytes(payload, maxBytes);
	assert.equal(capped._truncated, true);
	const reencoded = Buffer.from(capped.preview, "utf-8");
	// Round-trip equality proves the preview is well-formed UTF-8.
	assert.equal(reencoded.toString("utf-8"), capped.preview);
});

test("shared policy constants are exported for channel parity", () => {
	assert.ok(REDACT_KEY_PATTERN.test("apiToken"));
	assert.ok(Array.isArray(SECRET_VALUE_PATTERNS));
	assert.ok(SECRET_VALUE_PATTERNS.length >= 5);
	assert.ok(Object.isFrozen(SECRET_VALUE_PATTERNS));
});
