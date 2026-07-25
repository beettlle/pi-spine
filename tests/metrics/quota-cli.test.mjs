import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { runQuotaReport } from "../../src/metrics/quota-cli.mjs";

// Path guaranteed to be absent so the estimate/absent tests fail closed to
// "absent" probes deterministically, without touching the network or the
// operator's real ~/.pi/agent/auth.json.
const NO_AUTH_PATH = path.join(os.tmpdir(), "spine-sp687-missing-auth.json");

const baseConfig = () => ({
	configVersion: 1,
	project: { name: "quota-cli-fixture", description: "" },
	paths: { tasksRoot: "spine-tasks" },
	baseBranch: "main",
	testing: {
		build: "npm run typecheck",
		test: "npm test",
		testWithCoverage: "npm run coverage:check",
	},
	lanes: { maxParallel: 1, queueExcess: true },
	gates: {
		requireBeforeIntegrate: true,
		collectBuildEvidence: true,
		collectTestEvidence: true,
	},
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

async function setupProject(config) {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-cli-"));
	const spineDir = path.join(root, ".spine");
	fs.mkdirSync(spineDir, { recursive: true });
	fs.writeFileSync(path.join(spineDir, "spine-config.json"), JSON.stringify(config, null, 2), "utf-8");

	const metricsPath = path.join(spineDir, "run-metrics.jsonl");
	fs.writeFileSync(
		metricsPath,
		[
			JSON.stringify({
				recordType: "task",
				model: "zai/glm-5.2",
				durationMs: 1200,
				tokensIn: 10,
				tokensOut: 20,
				estimatedUsd: 0.001,
			}),
			JSON.stringify({
				recordType: "task",
				model: "zai/glm-5.2",
				durationMs: 800,
				tokensIn: 5,
				tokensOut: 15,
			}),
			JSON.stringify({ recordType: "task", model: "google/gemini-3.1-pro-preview", durationMs: 500 }),
		].join("\n") + "\n",
		"utf-8",
	);
	return root;
}

test("runQuotaReport writes a timestamped JSON report and human summary by default", async () => {
	const root = await setupProject(baseConfig());
	try {
		const result = await runQuotaReport({ projectRoot: root, authPath: NO_AUTH_PATH, now: "2026-07-21T12:34:56.789Z" });
		assert.equal(result.exitCode, 0);
		assert.ok(result.reportPath);
		assert.ok(result.reportPath.startsWith(path.join(root, ".spine", "reports")));
		assert.ok(result.reportPath.endsWith(".json"));
		assert.ok(fs.existsSync(result.reportPath));

		const snapshot = JSON.parse(fs.readFileSync(result.reportPath, "utf-8"));
		assert.equal(snapshot.generatedAt, "2026-07-21T12:34:56.789Z");
		assert.equal(snapshot.snapshotSource, "estimate");
		assert.equal(snapshot.pools.zai.usage.taskCount, 2);

		assert.ok(result.output.includes("Quota snapshot:"));
		assert.ok(result.output.includes("Report:"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaReport --json prints snapshot to stdout without writing a file", async () => {
	const root = await setupProject(baseConfig());
	try {
		const result = await runQuotaReport({ projectRoot: root, args: ["--json"], authPath: NO_AUTH_PATH, now: "2026-07-21T12:34:56.789Z" });
		assert.equal(result.exitCode, 0);
		assert.equal(result.reportPath, null);

		const snapshot = JSON.parse(result.output);
		assert.equal(snapshot.generatedAt, "2026-07-21T12:34:56.789Z");
		assert.equal(snapshot.snapshotSource, "estimate");
		assert.equal(snapshot.pools.zai.usage.taskCount, 2);
		assert.equal(snapshot.pools.zai.usage.tokensIn, 15);
		assert.equal(snapshot.pools.google.usage.taskCount, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaReport --open writes HTML beside the JSON report", async () => {
	const root = await setupProject(baseConfig());
	try {
		const result = await runQuotaReport({
			projectRoot: root,
			args: ["--open"],
			authPath: NO_AUTH_PATH,
			now: "2026-07-21T12:34:56.789Z",
		});
		assert.equal(result.exitCode, 0);
		assert.ok(result.reportPath);
		assert.ok(fs.existsSync(result.reportPath));
		const htmlPath = result.reportPath.replace(/\.json$/, ".html");
		assert.ok(fs.existsSync(htmlPath));
		assert.ok(result.output.includes("HTML:"));
		const html = fs.readFileSync(htmlPath, "utf-8");
		assert.ok(html.includes("Quota Headroom Report"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaReport returns an error when config is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-quota-cli-"));
	try {
		const result = await runQuotaReport({ projectRoot: root });
		assert.equal(result.exitCode, 1);
		assert.equal(result.reportPath, null);
		assert.ok(result.output.includes("Error:"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runQuotaReport accepts an explicit config and bypasses the file system", async () => {
	const config = baseConfig();
	const result = await runQuotaReport({
		projectRoot: "/tmp",
		config,
		authPath: NO_AUTH_PATH,
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 100 },
		],
		now: "2026-07-21T12:34:56.789Z",
	});
	assert.equal(result.exitCode, 0);
	assert.ok(result.reportPath);
	assert.ok(result.reportPath.startsWith("/tmp/.spine/reports"));
	const snapshot = JSON.parse(fs.readFileSync(result.reportPath, "utf-8"));
	assert.equal(snapshot.pools.zai.usage.taskCount, 1);
	await rm(path.dirname(result.reportPath), { recursive: true, force: true });
});

test("runQuotaReport never leaks secrets or prompt bodies", async () => {
	const config = baseConfig();
	config.agents.worker.apiKey = "sk-live-1234567890abcdef";
	config.agents.worker.prompt = "secret prompt body";
	config.secretToken = "super-secret";

	const result = await runQuotaReport({
		projectRoot: "/tmp",
		config,
		args: ["--json"],
		authPath: NO_AUTH_PATH,
		metricsLines: [
			{ recordType: "task", model: "zai/glm-5.2", durationMs: 100, apiKey: "sk-hidden", prompt: "leak me" },
		],
		now: "2026-07-21T12:34:56.789Z",
	});

	assert.equal(result.exitCode, 0);
	assert.ok(!result.output.includes("sk-live-1234567890abcdef"));
	assert.ok(!result.output.includes("secret prompt body"));
	assert.ok(!result.output.includes("super-secret"));
	assert.ok(!result.output.includes("sk-hidden"));
	assert.ok(!result.output.includes("leak me"));
	assert.ok(!result.output.includes("apiKey"));
	assert.ok(!result.output.includes("secretToken"));
	assert.ok(!result.output.includes("prompt"));
});

test("runQuotaReport --json with no observed metrics returns absent snapshot", async () => {
	const config = baseConfig();
	const result = await runQuotaReport({
		projectRoot: "/tmp",
		config,
		args: ["--json"],
		authPath: NO_AUTH_PATH,
		metricsLines: [],
		now: "2026-07-21T12:34:56.789Z",
	});

	assert.equal(result.exitCode, 0);
	const snapshot = JSON.parse(result.output);
	assert.equal(snapshot.snapshotSource, "absent");
	for (const pool of Object.values(snapshot.pools)) {
		assert.equal(pool.source, "absent");
	}
});

test("runQuotaReport enriches pools with live probes under mocked fetch", async () => {
	const root = await setupProject(baseConfig());
	try {
		// Fixture auth carries a Z.ai key. The key value must never surface in output.
		const authPath = path.join(root, "auth.json");
		fs.writeFileSync(authPath, JSON.stringify({ zai: { key: "probe-key-do-not-leak" } }), "utf-8");

		// Mocked fetch: live usage for the Z.ai quota endpoint; everything else 404s
		// so adapters fail closed. kimi-coding and cursor have no creds here, so only
		// the zai probe reaches the network mock.
		const mockFetch = async (url) => {
			if (String(url).includes("/quota/limit")) {
				return {
					ok: true,
					text: async () => JSON.stringify({ used: 12345, total: 50000 }),
				};
			}
			return { ok: false, text: async () => "" };
		};

		const result = await runQuotaReport({
			projectRoot: root,
			args: ["--json"],
			authPath,
			fetch: mockFetch,
			now: "2026-07-21T12:34:56.789Z",
		});

		assert.equal(result.exitCode, 0);
		const snapshot = JSON.parse(result.output);
		// zai had observed metrics (estimate baseline); the live probe promotes it.
		assert.equal(snapshot.snapshotSource, "live");
		assert.equal(snapshot.pools.zai.source, "live");
		assert.equal(snapshot.pools.zai.usage.tokensOut, 12345);
		assert.equal(snapshot.pools.zai.limit, 50000);
		// Probes must never leak the credential or any prompt body into JSON output.
		assert.ok(!result.output.includes("probe-key-do-not-leak"));
		assert.ok(!result.output.includes("apiKey"));
		assert.ok(!result.output.includes("prompt"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
