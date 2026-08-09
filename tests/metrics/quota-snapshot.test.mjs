import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import {
	aggregatePoolUsage,
	buildQuotaSnapshot,
	collectExpectedModels,
	resolvePoolId,
} from "../../src/metrics/quota-snapshot.mjs";

const baseConfig = () => ({
	agents: {
		worker: { model: "zai/glm-5.2", thinking: "high" },
		reviewer: {
			model: "google/gemini-3.1-pro-preview",
			thinking: "high",
			plan: { model: "google/gemini-flash-latest", thinking: "low" },
			code: { model: "kimi-coding/kimi-for-coding", thinking: "high" },
			final: { model: "google/gemini-3.1-pro-preview", thinking: "high" },
		},
		supervisor: { model: "google/gemini-flash-lite-latest", thinking: "off" },
	},
});

const profileConfig = () => ({
	agents: {
		worker: { model: "zai/glm-5.2", thinking: "high" },
		reviewer: {
			model: "google/gemini-3.1-pro-preview",
			thinking: "high",
			plan: { model: "google/gemini-flash-latest", thinking: "low" },
			code: { model: "kimi-coding/kimi-for-coding", thinking: "high" },
			final: { model: "google/gemini-3.1-pro-preview", thinking: "high" },
		},
		supervisor: { model: "google/gemini-flash-lite-latest", thinking: "off" },
		activeProfile: "hard",
		profiles: {
			default: {
				worker: { model: "zai/glm-5.2", thinking: "high" },
				reviewer: { model: "google/gemini-3.1-pro-preview", thinking: "high" },
				supervisor: { model: "google/gemini-flash-lite-latest", thinking: "off" },
			},
			hard: {
				worker: { model: "kimi-coding/kimi-k2-thinking", thinking: "high" },
				reviewer: {
					model: "google/gemini-3.1-pro-preview",
					thinking: "high",
					code: { model: "kimi-coding/kimi-k2-thinking", thinking: "high" },
				},
				supervisor: { model: "google/gemini-flash-lite-latest", thinking: "off" },
			},
		},
	},
});

test("resolvePoolId maps known provider prefixes to shared pools", () => {
	assert.equal(resolvePoolId("zai/glm-5.2"), "zai");
	assert.equal(resolvePoolId("kimi-coding/kimi-k2-thinking"), "kimi-coding");
	assert.equal(resolvePoolId("google/gemini-3.1-pro-preview"), "google");
	assert.equal(resolvePoolId("cursor/admin"), "cursor");
	assert.equal(resolvePoolId("cursor"), "cursor");
	assert.equal(resolvePoolId("anthropic/claude-opus-4.6"), "anthropic");
	assert.equal(resolvePoolId("anthropic/claude-sonnet-4.5"), "anthropic");
	assert.equal(resolvePoolId("github-copilot/claude-sonnet-4.5"), "github-copilot");
	assert.equal(resolvePoolId("github-copilot/gpt-4.1"), "github-copilot");
	// pi model ids use `github-copilot/`, not `copilot/`; bare `copilot` stays unmapped.
	assert.equal(resolvePoolId("copilot/gpt-4.1"), "unknown");
});

test("resolvePoolId treats empty, inherit, and unmapped providers as unknown", () => {
	assert.equal(resolvePoolId(""), "unknown");
	assert.equal(resolvePoolId(undefined), "unknown");
	assert.equal(resolvePoolId("inherit"), "unknown");
	assert.equal(resolvePoolId("openai/gpt-4"), "unknown");
	assert.equal(resolvePoolId("some-random-model"), "unknown");
});

test("collectExpectedModels gathers base agents and active profile", () => {
	const models = collectExpectedModels(profileConfig());
	assert.deepEqual(
		models.sort(),
		[
			"google/gemini-3.1-pro-preview",
			"google/gemini-flash-lite-latest",
			"google/gemini-flash-latest",
			"kimi-coding/kimi-for-coding",
			"kimi-coding/kimi-k2-thinking",
			"zai/glm-5.2",
		].sort(),
	);
});

test("collectExpectedModels ignores profiles that are not active", () => {
	const config = profileConfig();
	config.agents.activeProfile = "default";
	const models = collectExpectedModels(config);
	assert.ok(!models.includes("kimi-coding/kimi-k2-thinking"));
	assert.ok(models.includes("zai/glm-5.2"));
});

test("collectExpectedModels filters inherit and falsy values", () => {
	const config = {
		agents: {
			worker: { model: "inherit" },
			reviewer: { model: "zai/glm-5.2" },
			plan: { model: "" },
		},
	};
	const models = collectExpectedModels(config);
	assert.deepEqual(models, ["zai/glm-5.2"]);
});

test("aggregatePoolUsage omits usage fields that are absent", () => {
	const records = [
		{ recordType: "task", durationMs: 1200, model: "zai/glm-5.2" },
		{ recordType: "task", durationMs: 800, model: "zai/glm-5.2" },
	];
	const usage = aggregatePoolUsage(records);
	assert.equal(usage.taskCount, 2);
	assert.equal(usage.durationMs, 2000);
	assert.equal("tokensIn" in usage, false);
	assert.equal("tokensOut" in usage, false);
	assert.equal("estimatedUsd" in usage, false);
});

test("aggregatePoolUsage sums explicit usage fields when present", () => {
	const records = [
		{ recordType: "task", durationMs: 1200, tokensIn: 10, tokensOut: 20, estimatedUsd: 0.001 },
		{ recordType: "task", durationMs: 800, tokensIn: 5, tokensOut: 15, estimatedUsd: 0.002 },
	];
	const usage = aggregatePoolUsage(records);
	assert.equal(usage.taskCount, 2);
	assert.equal(usage.durationMs, 2000);
	assert.equal(usage.tokensIn, 15);
	assert.equal(usage.tokensOut, 35);
	assert.equal(usage.estimatedUsd, 0.003);
});

test("buildQuotaSnapshot joins config and observed metrics", () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 1200, tokensIn: 10, tokensOut: 20 },
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 800, tokensIn: 5, tokensOut: 15 },
			{ recordType: "task", model: "google/gemini-3.1-pro-preview", durationMs: 500, tokensIn: 100, tokensOut: 200 },
		],
		now: "2026-07-21T00:00:00.000Z",
	});

	assert.equal(snapshot.generatedAt, "2026-07-21T00:00:00.000Z");
	assert.equal(snapshot.snapshotSource, "estimate");
	assert.equal(Object.keys(snapshot.pools).length, 3);
	assert.equal(snapshot.pools.zai.source, "estimate");
	assert.deepEqual(snapshot.pools.zai.expectedModels, ["zai/glm-5.2"]);
	assert.deepEqual(snapshot.pools.zai.observedModels, ["zai/glm-5.2"]);
	assert.equal(snapshot.pools.zai.usage.taskCount, 2);
	assert.equal(snapshot.pools.zai.usage.durationMs, 2000);
	assert.equal(snapshot.pools.zai.usage.tokensIn, 15);
	assert.equal(snapshot.pools.zai.usage.tokensOut, 35);
	assert.equal(snapshot.pools.google.source, "estimate");
	assert.equal(snapshot.pools.google.usage.taskCount, 1);
	assert.equal(snapshot.pools.google.usage.tokensIn, 100);
	assert.equal(snapshot.pools["kimi-coding"].source, "absent"); // should not exist? Wait: baseConfig has no kimi-coding model; pool only appears when expected. Actually baseConfig doesn't have kimi-coding. But baseConfig has reviewer code model "kimi-coding/kimi-for-coding"? Wait base config in this test? I defined baseConfig with reviewer code "kimi-coding/kimi-for-coding". So yes kimi-coding expected. But no observed metrics. So source absent.
	assert.equal(snapshot.pools["kimi-coding"].usage.taskCount, 0);
	assert.equal(snapshot.pools["kimi-coding"].usage.durationMs, 0);
	assert.equal(snapshot.pools["kimi-coding"].drift.missingModels.length, 1);
	assert.equal(snapshot.pools["kimi-coding"].drift.missingModels[0], "kimi-coding/kimi-for-coding");
	assert.equal(snapshot.pools.zai.drift.unexpectedModels.length, 0);
	assert.equal(snapshot.pools.zai.drift.missingModels.length, 0);
});

test("buildQuotaSnapshot marks unobserved pools as absent", () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [{ recordType: "task", model: "zai/glm-5.2", durationMs: 100 }],
		now: Date.now(),
	});

	assert.equal(snapshot.snapshotSource, "estimate");
	assert.equal(snapshot.pools.zai.source, "estimate");
	assert.equal(snapshot.pools.google.source, "absent");
	assert.equal(snapshot.pools.google.usage.taskCount, 0);
	assert.equal(snapshot.pools.google.usage.durationMs, 0);
	assert.equal("tokensIn" in snapshot.pools.google.usage, false);
});

test("buildQuotaSnapshot groups unknown and inherit models into the unknown pool", () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "openai/gpt-4", durationMs: 100 },
			{ recordType: "task", model: "inherit", durationMs: 50 },
		],
		now: Date.now(),
	});

	assert.ok(snapshot.pools.unknown);
	assert.equal(snapshot.pools.unknown.source, "estimate");
	assert.equal(snapshot.pools.unknown.usage.taskCount, 2);
	assert.equal(snapshot.pools.unknown.usage.durationMs, 150);
	assert.deepEqual(snapshot.pools.unknown.observedModels.sort(), ["inherit", "openai/gpt-4"]);
	assert.equal(snapshot.pools.unknown.drift.missingModels.length, 0);
	assert.equal(snapshot.pools.unknown.drift.unexpectedModels.length, 2);
});

test("buildQuotaSnapshot uses live metrics from disk when metricsLines is not provided", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-snapshot-"));
	const metricsPath = path.join(root, ".spine", "run-metrics.jsonl");
	fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
	fs.writeFileSync(
		metricsPath,
		JSON.stringify({ recordType: "task", model: "zai/glm-5.2", durationMs: 1234 }) + "\n",
	);
	try {
		const snapshot = buildQuotaSnapshot({
			projectRoot: root,
			config: baseConfig(),
			now: Date.now(),
		});
		assert.equal(snapshot.pools.zai.source, "estimate");
		assert.equal(snapshot.pools.zai.usage.taskCount, 1);
		assert.equal(snapshot.pools.zai.usage.durationMs, 1234);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildQuotaSnapshot never leaks secrets or prompt bodies", () => {
	const config = baseConfig();
	config.agents.worker.apiKey = "sk-live-1234567890abcdef";
	config.agents.worker.prompt = "secret prompt body";
	config.secretToken = "super-secret";

	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config,
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 100, apiKey: "sk-hidden", prompt: "leak me" },
		],
		now: Date.now(),
	});

	const text = JSON.stringify(snapshot);
	assert.ok(!text.includes("sk-live-1234567890abcdef"));
	assert.ok(!text.includes("secret prompt body"));
	assert.ok(!text.includes("super-secret"));
	assert.ok(!text.includes("sk-hidden"));
	assert.ok(!text.includes("leak me"));
	assert.ok(!text.includes("apiKey"));
	assert.ok(!text.includes("secretToken"));
	assert.ok(!text.includes("prompt"));
});

test("buildQuotaSnapshot uses duration-only attribution when usage fields are absent", () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 1200 },
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 800 },
		],
		now: Date.now(),
	});

	assert.equal(snapshot.pools.zai.usage.taskCount, 2);
	assert.equal(snapshot.pools.zai.usage.durationMs, 2000);
	assert.equal("tokensIn" in snapshot.pools.zai.usage, false);
	assert.equal("tokensOut" in snapshot.pools.zai.usage, false);
	assert.equal("estimatedUsd" in snapshot.pools.zai.usage, false);
});

test("buildQuotaSnapshot reports absent when no task records are observed", () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [],
		now: Date.now(),
	});

	assert.equal(snapshot.snapshotSource, "absent");
	for (const pool of Object.values(snapshot.pools)) {
		assert.equal(pool.source, "absent");
	}
});
