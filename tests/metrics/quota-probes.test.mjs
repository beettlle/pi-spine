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

const ZAI_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
const KIMI_URL = "https://api.kimi.com/coding/v1/usages";
const MOONSHOT_URL = "https://api.moonshot.ai/v1/users/me/balance";

// Real response bodies from #351.
const ZAI_BODY = {
	code: 200,
	msg: "Operation successful",
	data: {
		limits: [
			{ type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 3, nextResetTime: 1792060376601 },
			{ type: "TOKENS_LIMIT", unit: 6, number: 1, percentage: 82, nextResetTime: 1792429296983 },
			{
				type: "TIME_LIMIT",
				unit: 5,
				number: 1,
				usage: 100,
				currentValue: 0,
				remaining: 100,
				percentage: 0,
				nextResetTime: 1794613818998,
				usageDetails: ["..."],
			},
		],
		level: "lite",
	},
	success: true,
};

const KIMI_BODY = {
	usage: { limit: "100", used: "100", resetTime: "2026-10-20T20:28:41.692533Z" },
	limits: [
		{
			window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" },
			detail: { limit: "100", used: "63", remaining: "37", resetTime: "2026-10-15T06:28:41.692533Z" },
		},
	],
	usages: {
		limit_5h: { used_ratio: 0.6275, reset_time: "2026-10-15T06:28:40Z" },
		limit_7d: { used_ratio: 1, reset_time: "2026-10-20T20:28:41Z" },
	},
};

async function withAuth(auth, fn) {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(authPath, JSON.stringify(auth));
	try {
		return await fn(authPath);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

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

test("runQuotaProbes parses real Z.ai, Kimi Coding, and Cursor responses", async () => {
	await withAuth(
		{
			zai: { type: "api_key", key: "zai-key" },
			"kimi-coding": { type: "api_key", key: "kimi-key" },
			cursor: { type: "admin_key", key: "cursor-admin-key" },
		},
		async (authPath) => {
			const fetch = createMockFetch([
				{ url: ZAI_URL, status: 200, body: ZAI_BODY },
				{ url: KIMI_URL, status: 200, body: KIMI_BODY },
				{ url: "https://api.cursor.com/teams/daily-usage-data", status: 200, body: { used_tokens: 500 } },
			]);
			const results = await runQuotaProbes({ authPath, fetch });

			assert.equal(results.zai.source, "live");
			assert.deepEqual(results.zai.windows, [
				{ window: "5h", percentUsed: 3, resetAt: new Date(1792060376601).toISOString() },
				{ window: "weekly", percentUsed: 82, resetAt: new Date(1792429296983).toISOString() },
				{
					window: "monthly_tool_calls",
					percentUsed: 0,
					used: 0,
					limit: 100,
					resetAt: new Date(1794613818998).toISOString(),
				},
			]);

			assert.equal(results["kimi-coding"].source, "live");
			assert.deepEqual(results["kimi-coding"].windows, [
				{ window: "5h", percentUsed: 62.75, resetAt: "2026-10-15T06:28:40.000Z" },
				{ window: "weekly", percentUsed: 100, resetAt: "2026-10-20T20:28:41.000Z" },
			]);

			assert.equal(results.cursor.source, "live");
			assert.equal(results.cursor.usage.tokensOut, 500);
			assert.equal("limit" in results.cursor, false);
		},
	);
});

test("probeZai still reads flat used/total bodies", async () => {
	await withAuth({ zai: { key: "zai-key" } }, async (authPath) => {
		const fetch = createMockFetch([{ url: ZAI_URL, status: 200, body: { data: { used: "1000", total: "50000" } } }]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.zai] });

		assert.equal(results.zai.source, "live");
		assert.equal(results.zai.usage.tokensOut, 1000);
		assert.equal(results.zai.limit, 50000);
		assert.equal("windows" in results.zai, false);
	});
});

test("Z.ai probe skips unknown limit entries and accepts numeric-string fields", async () => {
	await withAuth({ zai: { key: "zai-key" } }, async (authPath) => {
		const body = {
			data: {
				limits: [
					{ type: "TOKENS_LIMIT", unit: 9, number: 9, percentage: 50, nextResetTime: 1792060376601 },
					{ type: "TOKENS_LIMIT", unit: "3", number: "5", percentage: "41.5", nextResetTime: "1792060376601" },
					{ type: "TOKENS_LIMIT", unit: 6, number: 1 },
				],
			},
		};
		const fetch = createMockFetch([{ url: ZAI_URL, status: 200, body }]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.zai] });

		assert.equal(results.zai.source, "live");
		assert.deepEqual(results.zai.windows, [
			{ window: "5h", percentUsed: 41.5, resetAt: new Date(1792060376601).toISOString() },
		]);
	});
});

test("Kimi Coding probe calls the coding usages URL, never the Moonshot balance URL", async () => {
	await withAuth({ "kimi-coding": { key: "kimi-key" } }, async (authPath) => {
		const urls = [];
		let seenAuth;
		const fetch = async (url, init) => {
			urls.push(url);
			seenAuth = init?.headers?.Authorization;
			return { ok: true, status: 200, text: async () => JSON.stringify(KIMI_BODY) };
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.kimiCoding] });

		assert.deepEqual(urls, [KIMI_URL]);
		assert.equal(urls.includes(MOONSHOT_URL), false);
		assert.equal(seenAuth, "Bearer kimi-key");
		assert.equal(results["kimi-coding"].source, "live");
	});
});

test("Kimi Coding probe falls back to limits[].detail (5h) and top-level usage (weekly)", async () => {
	await withAuth({ "kimi-coding": { key: "kimi-key" } }, async (authPath) => {
		const { usages: _omit, ...body } = KIMI_BODY;
		const fetch = createMockFetch([{ url: KIMI_URL, status: 200, body }]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.kimiCoding] });

		assert.equal(results["kimi-coding"].source, "live");
		assert.deepEqual(results["kimi-coding"].windows, [
			{ window: "5h", percentUsed: 63, used: 63, limit: 100, resetAt: "2026-10-15T06:28:41.692Z" },
			{ window: "weekly", percentUsed: 100, used: 100, limit: 100, resetAt: "2026-10-20T20:28:41.692Z" },
		]);
	});
});

test("HTTP 200 with an unknown shape is unparsed, not live", async () => {
	await withAuth(
		{ zai: { key: "zai-key" }, "kimi-coding": { key: "kimi-key" } },
		async (authPath) => {
			const fetch = createMockFetch([
				{ url: ZAI_URL, status: 200, body: { code: 200, data: { level: "lite", limits: [] } } },
				{ url: KIMI_URL, status: 200, body: { hello: "world" } },
			]);
			const results = await runQuotaProbes({ authPath, fetch });

			for (const id of ["zai", "kimi-coding"]) {
				assert.equal(results[id].source, "unparsed");
				assert.equal(results[id].error, "HTTP 200 but no quota fields recognised");
				assert.equal("usage" in results[id], false);
				assert.equal("windows" in results[id], false);
			}
		},
	);
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
	assert.equal(results.google.source, "absent");
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
			{ url: ZAI_URL, status: 403, body: {} },
			{ url: KIMI_URL, status: 401, body: {} },
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
			{ url: ZAI_URL, status: 200, body: ZAI_BODY },
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
			{ url: ZAI_URL, status: 200, body: ZAI_BODY },
		]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.zai] });

		assert.equal(results.zai.source, "live");
		assert.equal("limit" in results.zai, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes returns live usage for the Anthropic Admin probe", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			anthropic: { type: "admin_key", key: "sk-ant-admin-secret" },
		}),
	);
	try {
		let seenHeaders;
		const fetch = async (url, init) => {
			seenHeaders = init?.headers;
			assert.equal(url, "https://api.anthropic.com/v1/organizations/usage_report/messages");
			return {
				ok: true,
				status: 200,
				text: async () => JSON.stringify({ used: 4200 }),
				json: async () => ({ used: 4200 }),
			};
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.anthropic] });

		assert.equal(results.anthropic.source, "live");
		assert.equal(results.anthropic.usage.tokensOut, 4200);
		assert.equal("limit" in results.anthropic, false);
		assert.equal(seenHeaders["x-api-key"], "sk-ant-admin-secret");
		assert.equal(seenHeaders["anthropic-version"], "2023-06-01");
		assert.equal(JSON.stringify(results).includes("sk-ant-admin-secret"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes does not probe Anthropic with a regular inference key", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			anthropic: { type: "api_key", key: "sk-ant-api-inference-key" },
		}),
	);
	try {
		let fetchCalled = false;
		const fetch = () => {
			fetchCalled = true;
			return Promise.resolve({ ok: true, status: 200, text: async () => "{}", json: async () => ({}) });
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.anthropic] });

		assert.equal(results.anthropic.source, "absent");
		assert.equal(fetchCalled, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes probes Anthropic with an adminKey field and degrades on 403", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			anthropic: { type: "api_key", key: "sk-ant-api-inference-key", adminKey: "sk-ant-admin-secret" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.anthropic.com/v1/organizations/usage_report/messages", status: 403, body: {} },
		]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.anthropic] });

		assert.equal(results.anthropic.source, "absent");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes returns live billing data for the GitHub Copilot org probe", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			"github-copilot": { type: "pat", key: "ghp-secret-token", org: "acme-org" },
		}),
	);
	try {
		let seenHeaders;
		const fetch = async (url, init) => {
			seenHeaders = init?.headers;
			assert.equal(url, "https://api.github.com/orgs/acme-org/copilot/billing");
			return {
				ok: true,
				status: 200,
				text: async () => JSON.stringify({ used: 120, limit: 300 }),
				json: async () => ({ used: 120, limit: 300 }),
			};
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.githubCopilot] });

		assert.equal(results["github-copilot"].source, "live");
		assert.equal(results["github-copilot"].usage.tokensOut, 120);
		assert.equal(results["github-copilot"].limit, 300);
		assert.equal(seenHeaders.Authorization, "Bearer ghp-secret-token");
		assert.equal(seenHeaders["X-GitHub-Api-Version"], "2022-11-28");
		assert.equal(JSON.stringify(results).includes("ghp-secret-token"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes supports the GitHub Copilot enterprise context", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			"github-copilot": { type: "pat", key: "ghp-secret-token", enterprise: "acme-ent" },
		}),
	);
	try {
		const fetch = createMockFetch([
			{ url: "https://api.github.com/enterprises/acme-ent/copilot/billing", status: 200, body: { used: 55 } },
		]);
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.githubCopilot] });

		assert.equal(results["github-copilot"].source, "live");
		assert.equal(results["github-copilot"].usage.tokensOut, 55);
		assert.equal("limit" in results["github-copilot"], false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes does not probe GitHub Copilot without org/enterprise scope", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			"github-copilot": { type: "pat", key: "ghp-secret-token" },
		}),
	);
	try {
		let fetchCalled = false;
		const fetch = () => {
			fetchCalled = true;
			return Promise.resolve({ ok: true, status: 200, text: async () => "{}", json: async () => ({}) });
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.githubCopilot] });

		assert.equal(results["github-copilot"].source, "absent");
		assert.equal(fetchCalled, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaProbes degrades GitHub Copilot to absent on 404 and network errors", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			"github-copilot": { type: "pat", key: "ghp-secret-token", org: "acme-org" },
		}),
	);
	try {
		const fetch404 = createMockFetch([
			{ url: "https://api.github.com/orgs/acme-org/copilot/billing", status: 404, body: {} },
		]);
		const notFound = await runQuotaProbes({ authPath, fetch: fetch404, providers: [PROBE_POOLS.githubCopilot] });
		assert.equal(notFound["github-copilot"].source, "absent");

		const fetchNetErr = createMockFetch([
			{ url: "https://api.github.com/orgs/acme-org/copilot/billing", status: 200, reject: "network failure" },
		]);
		const netErr = await runQuotaProbes({ authPath, fetch: fetchNetErr, providers: [PROBE_POOLS.githubCopilot] });
		assert.equal(netErr["github-copilot"].source, "absent");
		assert.ok(netErr["github-copilot"].error);
		assert.equal(JSON.stringify(netErr).includes("ghp-secret-token"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("PROBE_POOLS registers the google pool id", () => {
	assert.equal(PROBE_POOLS.google, "google");
});

test("runQuotaProbes keeps the Google probe permanently absent without network calls", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			google: { type: "api_key", key: "AIzaGoogleSecretKey" },
		}),
	);
	try {
		let fetchCalled = false;
		const fetch = () => {
			fetchCalled = true;
			return Promise.resolve({ ok: true, status: 200, text: async () => "{}", json: async () => ({}) });
		};
		const results = await runQuotaProbes({ authPath, fetch, providers: [PROBE_POOLS.google] });

		assert.equal(results.google.source, "absent");
		assert.equal(fetchCalled, false);
		assert.equal("usage" in results.google, false);
		assert.equal("limit" in results.google, false);
		assert.equal(JSON.stringify(results).includes("AIzaGoogleSecretKey"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("google pool stays on the offline estimate while the probe is permanently absent", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-probes-"));
	const authPath = path.join(root, "auth.json");
	fs.writeFileSync(
		authPath,
		JSON.stringify({
			google: { type: "api_key", key: "AIzaGoogleSecretKey" },
		}),
	);
	try {
		const probes = await runQuotaProbes({ authPath, fetch: createMockFetch([]) });
		const snapshot = buildQuotaSnapshot({
			projectRoot: "/tmp",
			config: { agents: { reviewer: { model: "google/gemini-3.1-pro-preview" } } },
			metricsLines: [
				{ recordType: "task", model: "google/gemini-3.1-pro-preview", durationMs: 800, tokensOut: 42 },
			],
			probeResults: probes,
			now: "2026-09-05T00:00:00.000Z",
		});

		assert.equal(snapshot.pools.google.source, "estimate");
		assert.equal(snapshot.pools.google.usage.tokensOut, 42);
		assert.equal("limit" in snapshot.pools.google, false);
		assert.equal(JSON.stringify(snapshot).includes("AIzaGoogleSecretKey"), false);
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

test("buildQuotaSnapshot passes probe windows through for live pools", async () => {
	const windows = [{ window: "5h", percentUsed: 63, resetAt: "2026-10-15T06:28:41.000Z" }];
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [],
		probeResults: {
			"kimi-coding": {
				poolId: "kimi-coding",
				source: "live",
				usage: { taskCount: 0, durationMs: 0 },
				windows: [...windows, { window: "bad", percentUsed: "x" }],
			},
		},
		now: Date.now(),
	});

	assert.equal(snapshot.pools["kimi-coding"].source, "live");
	assert.deepEqual(snapshot.pools["kimi-coding"].windows, windows);
	assert.equal("windows" in snapshot.pools.zai, false);
});

test("buildQuotaSnapshot treats an unparsed probe like absent (estimate fallback)", async () => {
	const snapshot = buildQuotaSnapshot({
		projectRoot: "/tmp",
		config: baseConfig(),
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 1200, tokensOut: 20 },
		],
		probeResults: {
			zai: { poolId: "zai", source: "unparsed", error: "HTTP 200 but no quota fields recognised" },
			"kimi-coding": { poolId: "kimi-coding", source: "unparsed", error: "HTTP 200 but no quota fields recognised" },
		},
		now: Date.now(),
	});

	assert.equal(snapshot.pools.zai.source, "estimate");
	assert.equal(snapshot.pools.zai.usage.tokensOut, 20);
	assert.equal(snapshot.pools["kimi-coding"].source, "absent");
	assert.equal(snapshot.snapshotSource, "estimate");
	assert.equal("windows" in snapshot.pools.zai, false);
});
