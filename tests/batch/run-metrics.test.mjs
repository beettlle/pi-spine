import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { skipTaskDoneOnDisk } from "../../src/batch/engine-lanes.mjs";
import {
	appendBatchMetric,
	appendTaskMetric,
	buildBatchMetricRecord,
	buildTaskMetricRecord,
	filterMetricsLines,
	formatMetricsTable,
	isMetricsEnabled,
	metricsFilePath,
	readMetricsLines,
	recordBatchTerminalMetric,
	resolveTaskMetricOutcome,
} from "../../src/batch/metrics.mjs";
import { formatMetricsRollups, rollupMetrics } from "../../src/batch/metrics-rollup.mjs";
import { dismissBatch } from "../../src/batch/lifecycle.mjs";
import { createInitialBatchState } from "../../src/batch/state.mjs";

async function withProject(run) {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-run-metrics-"));
	try {
		await run(projectRoot);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
}

test("appendTaskMetric writes TaskMetricRecord JSONL line", async () => {
	await withProject((projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		const record = buildTaskMetricRecord({
			batchId: "20260611T120000",
			task: {
				taskId: "SP-001",
				status: "succeeded",
				startedAt: Date.parse("2026-06-11T12:00:00.000Z"),
				endedAt: Date.parse("2026-06-11T12:05:00.000Z"),
				exitReason: "done",
			},
			config: {
				agents: { worker: { model: "inherit", thinking: "high" } },
			},
		});

		appendTaskMetric(projectRoot, record, config);

		const filePath = metricsFilePath(projectRoot, config);
		const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
		assert.equal(lines.length, 1);

		const parsed = JSON.parse(lines[0]);
		assert.equal(parsed.recordType, "task");
		assert.equal(parsed.schemaVersion, 1);
		assert.equal(parsed.batchId, "20260611T120000");
		assert.equal(parsed.taskId, "SP-001");
		assert.equal(parsed.agentRole, "worker");
		assert.equal(parsed.outcome, "completed");
		assert.equal(parsed.exitReason, "done");
		assert.equal(parsed.laneNumber, undefined);
		assert.equal(parsed.durationMs, 5 * 60 * 1000);
	});
});

test("buildTaskMetricRecord includes laneNumber and durationMs when available", () => {
	const startedAt = Date.parse("2026-06-11T12:00:00.000Z");
	const endedAt = Date.parse("2026-06-11T12:07:30.000Z");
	const record = buildTaskMetricRecord({
		batchId: "20260611T120000",
		task: {
			taskId: "SP-325",
			laneNumber: 3,
			status: "succeeded",
			startedAt,
			endedAt,
			exitReason: "done",
		},
		config: {
			agents: { worker: { model: "inherit", thinking: "high" } },
		},
	});

	assert.equal(record.laneNumber, 3);
	assert.equal(record.durationMs, endedAt - startedAt);
	assert.equal(record.schemaVersion, 1);
});

test("buildTaskMetricRecord omits laneNumber when not a positive lane", () => {
	const record = buildTaskMetricRecord({
		batchId: "20260611T120000",
		task: { taskId: "SP-001", status: "failed", exitReason: "worker_failed" },
		config: {},
	});

	assert.equal(record.laneNumber, undefined);
	assert.ok(Number.isFinite(record.durationMs));
});

test("metrics.enabled false skips append without error", async () => {
	await withProject((projectRoot) => {
		const config = { metrics: { enabled: false, path: ".spine/run-metrics.jsonl" } };
		const record = buildTaskMetricRecord({
			batchId: "20260611T120000",
			task: { taskId: "SP-001", status: "failed", exitReason: "worker_failed" },
			config,
		});

		const result = appendTaskMetric(projectRoot, record, config);
		assert.equal(result, null);
		assert.equal(isMetricsEnabled(config), false);
		assert.equal(fs.existsSync(metricsFilePath(projectRoot, config)), false);
	});
});

test("resolveTaskMetricOutcome maps skipped_done_on_disk to skipped", () => {
	assert.equal(
		resolveTaskMetricOutcome({ status: "succeeded", exitReason: "skipped_done_on_disk" }),
		"skipped",
	);
	assert.equal(resolveTaskMetricOutcome({ status: "failed", exitReason: "needs_replan" }), "failed");
});

test("appendTaskMetric redacts secret-like fields and preserves usage counts", async () => {
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
				outcome: "failed",
				promptText: "secret prompt",
				apiToken: "abc123",
				tokensIn: 1234,
				tokensOut: 567,
				estimatedUsd: 0.0123,
			},
			config,
		);

		const raw = fs.readFileSync(metricsFilePath(projectRoot, config), "utf-8");
		assert.doesNotMatch(raw, /secret prompt/);
		assert.doesNotMatch(raw, /abc123/);
		assert.match(raw, /\[REDACTED\]/);
		const parsed = JSON.parse(raw.trim());
		assert.equal(parsed.tokensIn, 1234);
		assert.equal(parsed.tokensOut, 567);
		assert.equal(parsed.estimatedUsd, 0.0123);
	});
});

test("buildTaskMetricRecord preserves usage fields and omits them when absent", async () => {
	const withUsage = buildTaskMetricRecord({
		batchId: "20260611T120000",
		task: {
			taskId: "SP-001",
			status: "succeeded",
			startedAt: Date.parse("2026-06-11T12:00:00.000Z"),
			endedAt: Date.parse("2026-06-11T12:05:00.000Z"),
			exitReason: "done",
			tokensIn: 1234,
			tokensOut: 567,
			estimatedUsd: 0.0123,
			role: "worker",
		},
		config: {
			agents: { worker: { model: "inherit", thinking: "high" } },
		},
	});
	assert.equal(withUsage.tokensIn, 1234);
	assert.equal(withUsage.tokensOut, 567);
	assert.equal(withUsage.estimatedUsd, 0.0123);
	assert.equal(withUsage.role, "worker");

	const withoutUsage = buildTaskMetricRecord({
		batchId: "20260611T120000",
		task: {
			taskId: "SP-002",
			status: "succeeded",
			startedAt: Date.parse("2026-06-11T12:00:00.000Z"),
			endedAt: Date.parse("2026-06-11T12:05:00.000Z"),
			exitReason: "done",
		},
		config: {
			agents: { worker: { model: "inherit", thinking: "high" } },
		},
	});
	assert.equal(withoutUsage.tokensIn, undefined);
	assert.equal(withoutUsage.tokensOut, undefined);
	assert.equal(withoutUsage.estimatedUsd, undefined);
	assert.equal(withoutUsage.role, undefined);
});

test("skipTaskDoneOnDisk records skipped task metric", async () => {
	await withProject(async (projectRoot) => {
		const batchId = "20260611T120000";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `spine/${batchId}`,
			wavePlan: [["SP-001"]],
			tasks: [
				{
					taskId: "SP-001",
					laneNumber: 1,
					status: "pending",
					taskFolder: null,
					startedAt: null,
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-001"] }],
		});
		const task = state.tasks[0];
		const lane = state.lanes[0];
		const taskFolderPath = path.join(projectRoot, "spine-tasks", "SP-001-fixture");
		fs.mkdirSync(taskFolderPath, { recursive: true });

		await skipTaskDoneOnDisk({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			taskFolderPath,
			laneCorrelationId: "corr-1",
			config: { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } },
		});

		const parsed = JSON.parse(
			fs.readFileSync(path.join(projectRoot, ".spine/run-metrics.jsonl"), "utf-8").trim(),
		);
		assert.equal(parsed.outcome, "skipped");
		assert.equal(parsed.exitReason, "skipped_done_on_disk");
		assert.equal(parsed.laneNumber, 1);
		assert.ok(Number.isFinite(parsed.durationMs));
	});
});

test("appendBatchMetric writes BatchMetricRecord JSONL line", async () => {
	await withProject((projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		const record = buildBatchMetricRecord({
			batchId: "20260611T120000",
			batchState: {
				startedAt: Date.parse("2026-06-11T12:00:00.000Z"),
				endedAt: Date.parse("2026-06-11T12:30:00.000Z"),
				tasks: [
					{ taskId: "SP-001", status: "succeeded" },
					{ taskId: "SP-002", status: "failed" },
				],
			},
			diagnosis: "completed",
		});

		appendBatchMetric(projectRoot, record, config);
		const parsed = JSON.parse(
			fs.readFileSync(metricsFilePath(projectRoot, config), "utf-8").trim(),
		);
		assert.equal(parsed.recordType, "batch");
		assert.equal(parsed.batchId, "20260611T120000");
		assert.equal(parsed.diagnosis, "completed");
		assert.equal(parsed.taskCount, 2);
		assert.equal(parsed.completedTasks, 1);
		assert.equal(parsed.failedTasks, 1);
	});
});

test("recordBatchTerminalMetric skips when metrics disabled", async () => {
	await withProject((projectRoot) => {
		const config = { metrics: { enabled: false, path: ".spine/run-metrics.jsonl" } };
		const result = recordBatchTerminalMetric({
			projectRoot,
			batchId: "20260611T120000",
			batchState: { tasks: [], startedAt: Date.now(), endedAt: Date.now() },
			diagnosis: "dismissed",
			config,
		});
		assert.equal(result, null);
	});
});

test("dismissBatch appends batch metric line", async () => {
	await withProject((projectRoot) => {
		const batchId = "20260611T130000";
		const batchState = {
			batchId,
			phase: "stopped",
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			startedAt: Date.now() - 1000,
			endedAt: null,
			failedTasks: 0,
			succeededTasks: 1,
			totalTasks: 1,
			mergeResults: [],
			tasks: [{ taskId: "SP-001", status: "succeeded", doneFileFound: true }],
			segments: [],
			lanes: [],
		};
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify(
				{
					project: { name: "test" },
					paths: { tasksRoot: "spine-tasks" },
					metrics: { enabled: true, path: ".spine/run-metrics.jsonl" },
				},
				null,
				2,
			),
		);
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify(batchState, null, 2),
		);

		const result = dismissBatch({ projectRoot, reason: "limbo-recovery", force: true });
		assert.equal(result.ok, true);

		const lines = readMetricsLines(path.join(projectRoot, ".spine", "run-metrics.jsonl"));
		assert.equal(lines.length, 1);
		assert.equal(lines[0].recordType, "batch");
	});
});

test("spine metrics show filters by batch and formats table output", async () => {
	await withProject(async (projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-a",
				task: { taskId: "SP-001", status: "succeeded", exitReason: "done" },
				config,
			}),
			config,
		);
		appendBatchMetric(
			projectRoot,
			buildBatchMetricRecord({
				batchId: "batch-a",
				batchState: { tasks: [], startedAt: Date.now(), endedAt: Date.now() },
				diagnosis: "completed",
			}),
			config,
		);
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-b",
				task: { taskId: "SP-002", status: "failed", exitReason: "worker_failed" },
				config,
			}),
			config,
		);

		const filePath = metricsFilePath(projectRoot, config);
		const filtered = filterMetricsLines(readMetricsLines(filePath), { batchId: "batch-a" });
		assert.equal(filtered.length, 2);
		assert.ok(filtered.every((line) => line.batchId === "batch-a"));

		const table = formatMetricsTable(filtered);
		assert.match(table, /batch-a/);
		assert.match(table, /SP-001/);
		assert.doesNotMatch(table, /batch-b/);
	});
});

test("spine metrics show CLI filters by batch id", async () => {
	await withProject(async (projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ project: { name: "test" }, metrics: config.metrics }, null, 2),
		);
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-a",
				task: { taskId: "SP-001", status: "succeeded" },
				config,
			}),
			config,
		);
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-b",
				task: { taskId: "SP-002", status: "failed" },
				config,
			}),
			config,
		);

		const spineBin = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../bin/spine.mjs",
		);
		const output = execFileSync(
			process.execPath,
			[spineBin, "metrics", "show", "--batch", "batch-a", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		const parsed = JSON.parse(output);
		assert.equal(parsed.lines.length, 1);
		assert.equal(parsed.lines[0].batchId, "batch-a");
	});
});

test("rollupMetrics aggregates usage by batch, model, and role", () => {
	const lines = [
		{
			recordType: "task",
			batchId: "b1",
			model: "model-a",
			role: "worker",
			tokensIn: 100,
			tokensOut: 50,
			estimatedUsd: 0.001,
		},
		{
			recordType: "task",
			batchId: "b1",
			model: "model-a",
			role: "reviewer",
			tokensIn: 200,
			tokensOut: 100,
			estimatedUsd: 0.002,
		},
		{
			recordType: "task",
			batchId: "b2",
			model: "model-b",
			agentRole: "worker",
			tokensIn: 300,
			tokensOut: 150,
			estimatedUsd: 0.003,
		},
	];
	const rollups = rollupMetrics(lines);
	assert.ok(rollups);
	assert.equal(rollups.byBatch["b1"].tokensIn, 300);
	assert.equal(rollups.byBatch["b1"].tokensOut, 150);
	assert.equal(rollups.byBatch["b1"].estimatedUsd, 0.003);
	assert.equal(rollups.byBatch["b1"].count, 2);
	assert.equal(rollups.byBatch["b2"].tokensIn, 300);
	assert.equal(rollups.byModel["model-a"].tokensIn, 300);
	assert.equal(rollups.byModel["model-b"].tokensIn, 300);
	assert.equal(rollups.byRole["worker"].tokensIn, 400);
	assert.equal(rollups.byRole["reviewer"].tokensIn, 200);
});

test("rollupMetrics returns null when no usage fields are present", () => {
	const lines = [
		{
			recordType: "task",
			batchId: "b1",
			model: "model-a",
			role: "worker",
			outcome: "completed",
		},
		{ recordType: "batch", batchId: "b1", taskCount: 1 },
	];
	assert.equal(rollupMetrics(lines), null);
});

test("formatMetricsRollups prints tables when usage present", () => {
	const rollups = rollupMetrics([
		{
			recordType: "task",
			batchId: "b1",
			model: "model-a",
			role: "worker",
			tokensIn: 100,
			tokensOut: 50,
			estimatedUsd: 0.001,
		},
	]);
	const output = formatMetricsRollups(rollups);
	assert.match(output, /Usage by batch/);
	assert.match(output, /b1/);
	assert.match(output, /100/);
	assert.match(output, /50/);
	assert.match(output, /Usage by model/);
	assert.match(output, /Usage by role/);
});

test("spine metrics show --json includes usage rollups when present", async () => {
	await withProject(async (projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ project: { name: "test" }, metrics: config.metrics }, null, 2),
		);
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-a",
				task: {
					taskId: "SP-001",
					status: "succeeded",
					tokensIn: 100,
					tokensOut: 50,
					estimatedUsd: 0.001,
					role: "worker",
				},
				config,
			}),
			config,
		);
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-a",
				task: {
					taskId: "SP-002",
					status: "succeeded",
					tokensIn: 200,
					tokensOut: 100,
					estimatedUsd: 0.002,
					role: "reviewer",
				},
				config,
			}),
			config,
		);

		const spineBin = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../bin/spine.mjs",
		);
		const output = execFileSync(
			process.execPath,
			[spineBin, "metrics", "show", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		const parsed = JSON.parse(output);
		assert.equal(parsed.lines.length, 2);
		assert.ok(parsed.rollups);
		assert.equal(parsed.rollups.byBatch["batch-a"].tokensIn, 300);
		assert.equal(parsed.rollups.byBatch["batch-a"].count, 2);
		assert.equal(parsed.rollups.byRole["worker"].tokensIn, 100);
		assert.equal(parsed.rollups.byRole["reviewer"].tokensIn, 200);
	});
});

test("spine metrics show --json keeps rollups null when usage is absent", async () => {
	await withProject(async (projectRoot) => {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ project: { name: "test" }, metrics: config.metrics }, null, 2),
		);
		appendTaskMetric(
			projectRoot,
			buildTaskMetricRecord({
				batchId: "batch-a",
				task: { taskId: "SP-001", status: "succeeded" },
				config,
			}),
			config,
		);

		const spineBin = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../bin/spine.mjs",
		);
		const output = execFileSync(
			process.execPath,
			[spineBin, "metrics", "show", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		const parsed = JSON.parse(output);
		assert.equal(parsed.lines.length, 1);
		assert.equal(parsed.rollups, null);
	});
});
