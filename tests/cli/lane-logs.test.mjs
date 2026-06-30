import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import {
	extractTaskIdFromLogFilename,
	findMostRecentLogTaskId,
	laneRuntimeDir,
	parseLaneLogsArgs,
	parseLaneNumber,
	resolveLaneLogPath,
	resolveLaneLogTaskId,
	runLaneLogs,
} from "../../src/cli/lane-logs.mjs";
import {
	workerLiveLogPath,
	workerOutputLogPath,
} from "../../src/batch/worker-output.mjs";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function writeBatchState(projectRoot, batchId) {
	const spineDir = path.join(projectRoot, ".spine");
	fs.mkdirSync(spineDir, { recursive: true });
	fs.writeFileSync(
		path.join(spineDir, "batch-state.json"),
		JSON.stringify(
			{
				batchId,
				phase: "running",
				tasks: [{ taskId: "SP-366", status: "running", laneNumber: 1 }],
				lanes: [{ laneNumber: 1, taskIds: ["SP-366"] }],
			},
			null,
			2,
		),
		"utf-8",
	);
}

test("parseLaneNumber accepts positive integers", () => {
	assert.equal(parseLaneNumber("1"), 1);
	assert.equal(parseLaneNumber("4"), 4);
	assert.equal(parseLaneNumber("0"), null);
	assert.equal(parseLaneNumber("-1"), null);
	assert.equal(parseLaneNumber("lane-1"), null);
});

test("parseLaneLogsArgs reads lane, task, batch, and follow flags", () => {
	assert.deepEqual(
		parseLaneLogsArgs(["--lane", "2", "--task", "SP-366", "--batch", "20260601T150000", "--follow"]),
		{
			laneNumber: 2,
			taskId: "SP-366",
			batchId: "20260601T150000",
			follow: true,
		},
	);
	assert.deepEqual(parseLaneLogsArgs(["--lane", "1"]), {
		laneNumber: 1,
		taskId: null,
		batchId: null,
		follow: false,
	});
});

test("extractTaskIdFromLogFilename parses worker log names", () => {
	assert.equal(extractTaskIdFromLogFilename("worker-live-SP-365.log", "worker-live-"), "SP-365");
	assert.equal(
		extractTaskIdFromLogFilename("worker-output-SP-056.log", "worker-output-"),
		"SP-056",
	);
	assert.equal(extractTaskIdFromLogFilename("journal.jsonl", "worker-live-"), null);
});

test("resolveLaneLogPath prefers live log when present", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T160000";
	const laneNumber = 1;
	const taskId = "SP-366";
	try {
		const livePath = workerLiveLogPath(root, batchId, laneNumber, taskId);
		const outputPath = workerOutputLogPath(root, batchId, laneNumber, taskId);
		fs.mkdirSync(path.dirname(livePath), { recursive: true });
		fs.writeFileSync(livePath, "live chunk\n", "utf-8");
		fs.writeFileSync(outputPath, "terminal chunk\n", "utf-8");

		const resolved = resolveLaneLogPath({ projectRoot: root, batchId, laneNumber, taskId });
		assert.equal(resolved.kind, "live");
		assert.equal(resolved.logPath, livePath);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("resolveLaneLogPath falls back to worker-output log", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T161000";
	const laneNumber = 2;
	const taskId = "SP-366";
	try {
		const outputPath = workerOutputLogPath(root, batchId, laneNumber, taskId);
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, "failure tail\n", "utf-8");

		const resolved = resolveLaneLogPath({ projectRoot: root, batchId, laneNumber, taskId });
		assert.equal(resolved.kind, "output");
		assert.equal(resolved.logPath, outputPath);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("findMostRecentLogTaskId picks newest log in lane directory", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T162000";
	const laneNumber = 3;
	try {
		const laneDir = laneRuntimeDir(root, batchId, laneNumber);
		fs.mkdirSync(laneDir, { recursive: true });
		fs.writeFileSync(path.join(laneDir, "worker-output-SP-100.log"), "old\n", "utf-8");
		const newerPath = path.join(laneDir, "worker-live-SP-200.log");
		fs.writeFileSync(newerPath, "newer\n", "utf-8");
		const past = Date.now() - 60_000;
		fs.utimesSync(path.join(laneDir, "worker-output-SP-100.log"), past / 1000, past / 1000);

		assert.equal(findMostRecentLogTaskId(laneDir), "SP-200");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("resolveLaneLogTaskId uses explicit task id", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T163000";
	try {
		assert.equal(
			resolveLaneLogTaskId({
				projectRoot: root,
				batchId,
				laneNumber: 1,
				taskId: "SP-999",
			}),
			"SP-999",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("resolveLaneLogTaskId infers running task from batch state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T164000";
	try {
		writeBatchState(root, batchId);
		assert.equal(
			resolveLaneLogTaskId({
				projectRoot: root,
				batchId,
				laneNumber: 1,
				taskId: null,
			}),
			"SP-366",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runLaneLogs exits non-zero when lane is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	try {
		const result = await runLaneLogs({
			projectRoot: root,
			args: ["--batch", "20260601T165000"],
			follow: false,
			deps: defaultLaneLogsDeps(),
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Lane number is required/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runLaneLogs exits non-zero when no batch can be resolved", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	try {
		const result = await runLaneLogs({
			projectRoot: root,
			args: ["--lane", "1"],
			follow: false,
			deps: defaultLaneLogsDeps(),
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /No active batch/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runLaneLogs prints existing log without following", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T170000";
	const laneNumber = 1;
	const taskId = "SP-366";
	try {
		writeBatchState(root, batchId);
		const outputPath = workerOutputLogPath(root, batchId, laneNumber, taskId);
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, "worker stdout line\n", "utf-8");

		const result = await runLaneLogs({
			projectRoot: root,
			args: ["--lane", "1"],
			follow: false,
			deps: defaultLaneLogsDeps(),
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /worker stdout line/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runLaneLogs prefers live log content", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-"));
	const batchId = "20260601T171000";
	const laneNumber = 1;
	const taskId = "SP-366";
	try {
		writeBatchState(root, batchId);
		const livePath = workerLiveLogPath(root, batchId, laneNumber, taskId);
		const outputPath = workerOutputLogPath(root, batchId, laneNumber, taskId);
		fs.mkdirSync(path.dirname(livePath), { recursive: true });
		fs.writeFileSync(livePath, "streaming now\n", "utf-8");
		fs.writeFileSync(outputPath, "stale output\n", "utf-8");

		const result = await runLaneLogs({
			projectRoot: root,
			args: ["--lane", "1", "--task", taskId],
			follow: false,
			deps: defaultLaneLogsDeps(),
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /streaming now/);
		assert.doesNotMatch(result.output, /stale output/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spine lane logs exits non-zero when log file missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lane-logs-cli-"));
	const spineBin = path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
		"..",
		"bin",
		"spine.mjs",
	);
	const batchId = "20260601T172000";
	try {
		writeBatchState(root, batchId);
		const result = spawnSync(
			process.execPath,
			[spineBin, "lane", "logs", "--lane", "1", "--task", "SP-MISSING"],
			{
				cwd: root,
				encoding: "utf-8",
			},
		);
		assert.notEqual(result.status, 0);
		assert.match(result.stderr + result.stdout, /Worker log not found/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

/**
 * @returns {{ fs: typeof fs, stdout: { write: (chunk: string) => void }, onSignal: () => void, offSignal: () => void }}
 */
function defaultLaneLogsDeps() {
	return {
		fs,
		stdout: { write: () => {} },
		onSignal: () => {},
		offSignal: () => {},
	};
}
