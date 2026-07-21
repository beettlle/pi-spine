import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { buildQuotaSnapshot } from "../../src/metrics/quota-snapshot.mjs";
import {
	loadAuthCredentials,
	PROBE_POOLS,
	runQuotaProbes,
} from "../../src/metrics/quota-probes.mjs";

const baseConfig = () => ({
	agents: {
		worker: { model: "zai/glm-5.2", thinking: "high" },
		reviewer: {
			model: "google/gemini-3.1-pro-preview",
			thinking: "high",
			code: { model: "kimi-coding/kimi-for-coding", thinking: "high" },
		},
	},
});

function createMockFetch(responses) {
	return async (url, _init) => {
		for (const response of responses) {
			if (url === response.url) {
				if (response.reject) throw new Error(response.reject);
				return {
					ok: response.status < 400,
					status: response.status,
					text: async () => JSON.stringify(response.body ?? {}),
					json: async () => response.body ?? {},
				};
			}
		}
		return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
	};
}

test("loadAuthCredentials parses auth file and returns null on failure", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	try {
		fs.writeFileSync(authPath, JSON.stringify({ zai: { key: "zai-key" } }));
		assert.deepEqual(loadAuthCredentials(authPath), { zai: { key: "zai-key" } });

		fs.writeFileSync(authPath, "not json");
		assert.equal(loadAuthCredentials(authPath), null);

		assert.equal(loadAuthCredentials(path.join(root, "missing.json")), null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes returns live usage for all providers with mocked responses", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			zai: { type: "api_key", key: "zai-key" },
			"kimi-coding": { type: "api_key", key: "kimi-key" },
			cursor: { type: "admin_key", key: "cursor-admin-key" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.z.ai/api/monitor/usage/quota/limit", status: 200, body: { used: 1000, total: 50000 } },
			{ url: "https://api.moonshot.ai/v1/users/me/balance", status: 200, body: { used: 2000, balance: 0.5, total: 10000 } },
			{ url: "https://api.cursor.com/teams/daily-usage-data", status: 200, body: { used_tokens: 500 } },
		]);
		const results = await runQuotaProbes({ authPath, fetch });

		assert.equal(results.zai.source, "live");
		assert.equal(results.zai.usage.tokensOut, 1000);
		assert.equal(results.zai.limit, 50000);

		assert.equal(results["kimi-coding"].source, "live");
		assert.equal(results["kimi-coding"].usage.tokensOut, 2000);
		assert.equal(results["kimi-coding"].usage.estimatedUsd, 0.5);
		assert.equal(results["kimi-coding"].limit, 10000);

		assert.equal(results.cursor.source, "live");
		assert.equal(results.cursor.usage.tokensOut, 500);
		assert.equal("limit" in results.cursor, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes degrades to absent when auth is missing", async () => {
	const fetch = createMockFetch([]);
	const results = await runQuotaProbes({
		authPath: path.join(os.tmpdir(), "does-not-exist-auth.json"),
		fetch,
	});

	assert.equal(results.zai.source, "absent");
	assert.equal(results["kimi-coding"].source, "absent");
	assert.equal(results.cursor.source, "absent");
	assert.equal(fetch.calls, undefined); // fetch never called
});

test("runQuotaProbes degrades to absent on 403 and non-Enterprise errors", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			zai: { type: "api_key", key: "zai-key" },
			"kimi-coding": { type: "api_key", key: "kimi-key" },
			cursor: { type: "admin_key", key: "cursor-admin-key" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.z.ai/api/monitor/usage/quota/limit", status: 403, body: {} },
			{ url: "https://api.moonshot.ai/v1/users/me/balance", status: 401, body: {} },
			{ url: "https://api.cursor.com/teams/daily-usage-data", status: 404, body: {} },
		]);
		const results = await runQuotaProbes({ authPath, fetch });

		assert.equal(results.zai.source, "absent");
		assert.equal(results["kimi-coding"].source, "absent");
		assert.equal(results.cursor.source, "absent");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes degrades to absent on network errors", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			zai: { type: "api_key", key: "zai-key" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.z.ai/api/monitor/usage/quota/limit", status: 200, reject: "network failure" },
		]);
		const results = await runQuotaProbes({ authPath, fetch });

		assert.equal(results.zai.source, "absent");
		assert.ok(results.zai.error);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes does not probe Cursor without explicit admin key", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			cursor: { type: "api_key", key: "cursor-regular-key" },
		}),
	);
	try {
		let fetchCalled = false;
		const fetch = () => {
			fetchCalled = true;
			return Promise.resolve({ ok: true, status: 200, text: async () => "{}", json: async () => ({}) });
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.cursor] });

		assert.equal(results.cursor.source, "absent");
		assert.equal(fetchCalled, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes probes Cursor with adminKey field", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			cursor: { type: "api_key", key: "cursor-regular-key", adminKey: "cursor-admin-key" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.cursor.com/teams/daily-usage-data", status: 200, body: { total_tokens: 999 } },
		]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.cursor] });

		assert.equal(results.cursor.source, "live");
		assert.equal(results.cursor.usage.tokensOut, 999);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes never includes secrets in results", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			zai: { type: "api_key", key: "sk-zai-secret" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.z.ai/api/monitor/usage/quota/limit", status: 200, body: { used: 100 } },
		]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.zai] });
		const text = JSON.stringify(results);

		assert.equal(text.includes("sk-zai-secret"), false);
		assert.equal(results.zai.source, "live");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes does not invent a remaining limit", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			zai: { type: "api_key", key: "zai-key" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.z.ai/api/monitor/usage/quota/limit", status: 200, body: { used: 100 } },
		]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.zai] });

		assert.equal(results.zai.source, "live");
		assert.equal("limit" in results.zai, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildQuotaSnapshot merges live probe results into pool source and usage", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 1200, tokensIn: 10, tokensOut: 20 },
		],
		probeResults: {
			zai: {
				poolId: "zai",
				source: "live",
				usage: { taskCount: 0, durationMs: 0, tokensOut: 5000 },
				limit: 10000,
			},
		},
		now: "2026-07-21T00:00:00.000Z",
	});

	assert.equal(snapshot.snapshotSource, "live");
	assert.equal(snapshot.pools.zai.source, "live");
	assert.equal(snapshot.pools.zai.usage.tokensOut, 5000);
	assert.equal(snapshot.pools.zai.limit, 10000);
	assert.equal(snapshot.pools["kimi-coding"].source, "absent");
});

test("buildQuotaSnapshot falls back to estimate when probe is absent", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 1200, tokensIn: 10, tokensOut: 20 },
		],
		probeResults: {
			zai: { poolId: "zai", source: "absent" },
		},
		now: Date.now(),
	});

	assert.equal(snapshot.snapshotSource, "estimate");
	assert.equal(snapshot.pools.zai.source, "estimate");
	assert.equal(snapshot.pools.zai.usage.tokensOut, 20);
	assert.equal("limit" in snapshot.pools.zai, false);
});

test("buildQuotaSnapshot marks expected pool live even with no observed metrics", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [],
		probeResults: {
			zai: {
				poolId: "zai",
				source: "live",
				usage: { taskCount: 0, durationMs: 0, tokensOut: 5000 },
			},
		},
		now: Date.now(),
	});

	assert.equal(snapshot.snapshotSource, "live");
	assert.equal(snapshot.pools.zai.source, "live");
	assert.equal(snapshot.pools.zai.usage.tokensOut, 5000);
});

test("buildQuotaSnapshot never leaks probe keys or secrets into output", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [],
		probeResults: {
			zai: {
				poolId: "zai",
				source: "live",
				usage: { taskCount: 0, durationMs: 0, tokensOut: 5000 },
			},
		},
		now: Date.now(),
	});

	const text = JSON.stringify(snapshot);
	assert.equal(text.includes("apiKey"), false);
	assert.equal(text.includes("sk-"), false);
	assert.equal(text.includes("key"), false);
});

test("buildQuotaSnapshot never invents a limit when probe does not provide one", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [],
		probeResults: {
			zai: {
				poolId: "zai",
				source: "live",
				usage: { taskCount: 0, durationMs: 0, tokensOut: 5000 },
			},
		},
		now: Date.now(),
	});

	assert.equal("limit" in snapshot.pools.zai, false);
});

test("buildQuotaSnapshot ignores malformed probe results", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 1200, tokensOut: 20 },
		],
		probeResults: {
			zai: { poolId: "zai", source: "not-a-source" },
		},
		now: Date.now(),
	});

	assert.equal(snapshot.pools.zai.source, "estimate");
	assert.equal(snapshot.pools.zai.usage.tokensOut, 20);
});
