import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rm, mkdtemp } from "node:fs/promises";

import { runWorker } from "../../src/batch/worker-host.mjs";
import { startAgentSessionWorker } from "../../src/batch/agent-session-worker.mjs";
import {
	appendWorkerLiveLogChunk,
	createWorkerLiveLogWriter,
	resolveWorkerOutputConfig,
	truncateLiveLogBytes,
	workerLiveLogPath,
	workerOutputLogPath,
} from "../../src/batch/worker-output.mjs";

test("resolveWorkerOutputConfig defaults live log streaming off", () => {
	const config = resolveWorkerOutputConfig({});
	assert.equal(config.streamWorkerOutputLive, false);
	assert.equal(config.workerLiveLogMaxBytes, 262_144);

	const enabled = resolveWorkerOutputConfig({
		lanes: { streamWorkerOutputLive: true, workerLiveLogMaxBytes: 4096 },
	});
	assert.equal(enabled.streamWorkerOutputLive, true);
	assert.equal(enabled.workerLiveLogMaxBytes, 4096);
});

test("workerLiveLogPath matches runtime layout", () => {
	const logPath = workerLiveLogPath("/proj", "20260629T120000", 2, "SP-365");
	assert.equal(
		logPath,
		path.join(
			"/proj",
			".spine",
			"runtime",
			"20260629T120000",
			"lanes",
			"lane-2",
			"worker-live-SP-365.log",
		),
	);
});

test("truncateLiveLogBytes applies truncation marker when over cap", () => {
	const capped = truncateLiveLogBytes(`${"line\n".repeat(20)}tail-marker`, 48);
	assert.match(capped, /worker output truncated/);
	assert.match(capped, /tail-marker/);
});

test("appendWorkerLiveLogChunk redacts secrets and enforces byte cap", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-live-log-unit-"));
	try {
		const logPath = path.join(root, "worker-live-SP-365.log");
		const outputConfig = resolveWorkerOutputConfig({
			lanes: { workerLiveLogMaxBytes: 96, workerOutputDenyPatterns: ["CUSTOM_SECRET_\\d+"] },
		});

		appendWorkerLiveLogChunk({
			logPath,
			rawChunk: "line one\nDATABASE_URL=postgres://secret\n",
			outputConfig,
		});
		appendWorkerLiveLogChunk({
			logPath,
			rawChunk: "CUSTOM_SECRET_999\nline three\n",
			outputConfig,
		});

		const content = fs.readFileSync(logPath, "utf-8");
		assert.match(content, /line one/);
		assert.doesNotMatch(content, /postgres:\/\/secret/);
		assert.doesNotMatch(content, /CUSTOM_SECRET_999/);
		assert.match(content, /\[REDACTED\]/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("createWorkerLiveLogWriter returns null when streaming disabled", () => {
	assert.equal(
		createWorkerLiveLogWriter({
			projectRoot: "/proj",
			batchId: "batch",
			laneNumber: 1,
			taskId: "SP-365",
			config: {},
		}),
		null,
	);
});

test("runWorker streams subprocess stub output to live log when enabled", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-live-subprocess-"));
	const batchId = "20260629T130000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-365";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-live`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_OUTPUT = "live subprocess diagnostic line";

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId,
			config: { lanes: { streamWorkerOutputLive: true } },
		});

		assert.equal(result.ok, true);
		const livePath = workerLiveLogPath(projectRoot, batchId, 1, taskId);
		assert.ok(fs.existsSync(livePath), "live log should exist during successful stub run");
		assert.match(fs.readFileSync(livePath, "utf-8"), /live subprocess diagnostic/);
		assert.equal(
			fs.existsSync(workerOutputLogPath(projectRoot, batchId, 1, taskId)),
			false,
			"terminal failure log should not be written on success",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevOutput === undefined) delete process.env.SPINE_WORKER_STUB_OUTPUT;
		else process.env.SPINE_WORKER_STUB_OUTPUT = prevOutput;
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorker skips live log when streamWorkerOutputLive is false", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-live-off-"));
	const batchId = "20260629T140000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-365B";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-off`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_OUTPUT = "should not land in live log";

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId,
			config: { lanes: { streamWorkerOutputLive: false } },
		});

		assert.equal(result.ok, true);
		assert.equal(
			fs.existsSync(workerLiveLogPath(projectRoot, batchId, 1, taskId)),
			false,
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevOutput === undefined) delete process.env.SPINE_WORKER_STUB_OUTPUT;
		else process.env.SPINE_WORKER_STUB_OUTPUT = prevOutput;
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorker still writes terminal failure log when live streaming enabled", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-live-stall-"));
	const batchId = "20260629T150000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-365C";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-stall`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = "120000";
	process.env.SPINE_WORKER_STUB_OUTPUT = "stall while streaming live";

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 2,
			taskId,
			config: {
				lanes: {
					streamWorkerOutputLive: true,
					stallTimeoutMinutes: 0.02,
					stallGraceAfterProgressMinutes: 0.01,
					heartbeatIntervalMinutes: 60,
				},
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "stall_timeout");

		const livePath = workerLiveLogPath(projectRoot, batchId, 2, taskId);
		const failurePath = workerOutputLogPath(projectRoot, batchId, 2, taskId);
		assert.ok(fs.existsSync(livePath), "live log should capture streamed output");
		assert.match(fs.readFileSync(livePath, "utf-8"), /stall while streaming live/);
		assert.ok(fs.existsSync(failurePath), "terminal failure log should still be written");
		assert.match(fs.readFileSync(failurePath, "utf-8"), /stall while streaming live/);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevHang === undefined) delete process.env.SPINE_WORKER_STUB_HANG_MS;
		else process.env.SPINE_WORKER_STUB_HANG_MS = prevHang;
		if (prevOutput === undefined) delete process.env.SPINE_WORKER_STUB_OUTPUT;
		else process.env.SPINE_WORKER_STUB_OUTPUT = prevOutput;
		await rm(root, { recursive: true, force: true });
	}
});

test("startAgentSessionWorker flushes transcript chunks to live log", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-live-agent-"));
	const batchId = "20260629T160000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-365D";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-agent`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");

	const createStreamingSession = ({ worktreePath: cwd, taskFolder: folder }) => {
		const donePath = path.join(folder, ".DONE");
		return {
			subscribe(listener) {
				listener({ delta: "agent session chunk alpha\n" });
				listener({ text: "token=supersecret\n" });
				return () => {};
			},
			prompt: async () => {
				const { writeWorkerDoneMarker } = await import("../../src/batch/worker-output.mjs");
				writeWorkerDoneMarker(donePath, { taskId });
			},
			dispose: () => {},
		};
	};

	try {
		const handle = startAgentSessionWorker(
			{
				worktreePath,
				taskFolder,
				projectRoot,
				config: { lanes: { streamWorkerOutputLive: true, workerLiveLogMaxBytes: 256 } },
				journal: { projectRoot, batchId, laneNumber: 3, taskId },
			},
			{
				createAgentSession: async () => ({
					session: createStreamingSession({ worktreePath, taskFolder }),
				}),
			},
		);

		const result = await handle.wait();
		assert.equal(result.exitCode, 0);

		const livePath = workerLiveLogPath(projectRoot, batchId, 3, taskId);
		assert.ok(fs.existsSync(livePath), "agent session live log should be flushed");
		const content = fs.readFileSync(livePath, "utf-8");
		assert.match(content, /agent session chunk alpha/);
		assert.doesNotMatch(content, /supersecret/);
		assert.match(content, /\[REDACTED\]/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("appendWorkerLiveLogChunk rolls file with truncation marker when over max bytes", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-live-cap-"));
	try {
		const logPath = path.join(root, "worker-live-cap.log");
		const outputConfig = resolveWorkerOutputConfig({
			lanes: { workerLiveLogMaxBytes: 48 },
		});

		appendWorkerLiveLogChunk({ logPath, rawChunk: "a".repeat(40), outputConfig });
		appendWorkerLiveLogChunk({ logPath, rawChunk: "b".repeat(40), outputConfig });

		const content = fs.readFileSync(logPath, "utf-8");
		assert.match(content, /worker output truncated/);
		assert.ok(Buffer.byteLength(content, "utf-8") <= 48);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
