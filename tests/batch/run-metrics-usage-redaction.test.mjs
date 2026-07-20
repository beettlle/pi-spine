import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	appendTaskMetric,
	metricsFilePath,
} from "../../src/batch/metrics.mjs";

/**
 * Isolated from run-metrics.test.mjs: when this case lived mid-file in the main
 * suite, full-suite V8 coverage for extensions/spine/slash-commands.ts collapsed
 * from ~92% to ~20% (release:check per-file floor). Same assertions here keep
 * SP-676 coverage without poisoning slash-command attribution.
 */
async function withProject(run) {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-run-metrics-usage-"));
	try {
		await run(projectRoot);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
}

test("sanitizeMetricRecord preserves usage keys but still redacts secrets", async () => {
	await withProject((projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		appendTaskMetric(
			projectRoot,
			{
				recordType: "task",
				schemaVersion: 1,
				batchId: "20260611T120000",
				taskId: "SP-001",
				agentRole: "worker",
				model: "inherit",
				thinking: "high",
				startedAt: "2026-06-11T12:00:00.000Z",
				endedAt: "2026-06-11T12:05:00.000Z",
				outcome: "completed",
				tokensIn: 1234,
				tokensOut: 567,
				estimatedUsd: 0.0123,
				apiToken: "should-redact",
				promptText: "secret prompt",
			},
			config,
		);

		const parsed = JSON.parse(
			fs.readFileSync(metricsFilePath(projectRoot, config), "utf-8").trim(),
		);
		assert.equal(parsed.tokensIn, 1234);
		assert.equal(parsed.tokensOut, 567);
		assert.equal(parsed.estimatedUsd, 0.0123);
		assert.equal(parsed.apiToken, "[REDACTED]");
		assert.equal(parsed.promptText, "[REDACTED]");
	});
});
