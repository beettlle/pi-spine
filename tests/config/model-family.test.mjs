import assert from "node:assert/strict";
import test from "node:test";

import { isSameModelFamily, resolveModelFamily } from "../../src/config/model-family.mjs";

const FAMILY_TABLE = [
	["google/gemini-2.5-pro", "gemini"],
	["google/gemini-4-argon", "gemini"],
	["anthropic/claude-sonnet-5-5", "claude"],
	["zai/glm-5.3-flash", "glm"],
	["kimi-coding/k3", "kimi"],
	["cursor/auto", "unknown"],
	["cursor/gemini-3.1-pro", "gemini"],
	["llama.cpp/qwen3.8-flash-next-iq3_s", "qwen"],
	["openai/gpt-5", "gpt"],
	["openai/o3", "gpt"],
	["moonshot/kimi-k2", "kimi"],
	["inherit", "unknown"],
	["", "unknown"],
	[null, "unknown"],
	[undefined, "unknown"],
];

for (const [model, family] of FAMILY_TABLE) {
	test(`resolveModelFamily(${JSON.stringify(model)}) is ${family}`, () => {
		assert.equal(resolveModelFamily(model), family);
	});
}

test("resolveModelFamily falls back on provider when the name does not match", () => {
	assert.equal(resolveModelFamily("google/nano-banana"), "gemini");
	assert.equal(resolveModelFamily("anthropic/haiku-5"), "claude");
	assert.equal(resolveModelFamily("zai/turbo-1"), "glm");
	assert.equal(resolveModelFamily("kimi-coding/moonlight"), "kimi");
	assert.equal(resolveModelFamily("acme/mystery"), "unknown");
});

test("resolveModelFamily prefers the model name over the provider", () => {
	assert.equal(resolveModelFamily("cursor/gemini-3.1-pro"), "gemini");
	assert.equal(resolveModelFamily("google/claude-lookalike"), "claude");
});

test("isSameModelFamily is true only for equal known families", () => {
	assert.equal(isSameModelFamily("google/gemini-2.5-pro", "google/gemini-4-argon"), true);
	assert.equal(isSameModelFamily("google/gemini-2.5-pro", "cursor/gemini-3.1-pro"), true);
	assert.equal(isSameModelFamily("google/gemini-2.5-pro", "anthropic/claude-sonnet-5-5"), false);
	assert.equal(isSameModelFamily("cursor/auto", "cursor/auto"), false);
	assert.equal(isSameModelFamily("inherit", "inherit"), false);
	assert.equal(isSameModelFamily(null, null), false);
	assert.equal(isSameModelFamily(null, "google/gemini-2.5-pro"), false);
});
