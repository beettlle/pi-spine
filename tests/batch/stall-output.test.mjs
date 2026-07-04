import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rm, mkdtemp } from "node:fs/promises";

import { collectEvidenceBundle } from "../../src/batch/evidence.mjs";
import {
	extractJournalDiagnosisHints,
	readJournalEvents,
	summarizeJournalEvent,
} from "../../src/batch/journal.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";
import {
	captureWorkerOutputTail,
	redactWorkerOutput,
	resolveWorkerOutputConfig,
	workerOutputLogPath,
} from "../../src/batch/worker-output.mjs";

test("resolveWorkerOutputConfig applies lane defaults and overrides", () => {
	const defaults = resolveWorkerOutputConfig({});
	assert.equal(defaults.maxBytes, 262_144);
	assert.equal(defaults.tailLines, 200);
	assert.equal(defaults.retainOnSuccess, false);

	const custom = resolveWorkerOutputConfig({
		lanes: {
			workerOutputMaxBytes: 1024,
			workerOutputTailLines: 5,
			retainWorkerOutputOnSuccess: true,
			workerOutputDenyPatterns: ["CUSTOM_SECRET_\\d+"],
		},
	});
	assert.equal(custom.maxBytes, 1024);
	assert.equal(custom.tailLines, 5);
	assert.equal(custom.retainOnSuccess, true);
});

test("captureWorkerOutputTail keeps last lines and marks byte truncation", () => {
	const config = resolveWorkerOutputConfig({
		lanes: { workerOutputMaxBytes: 64, workerOutputTailLines: 3 },
	});
	const raw = ["line-1", "line-2", "line-3", "line-4"].join("\n");
	const captured = captureWorkerOutputTail(raw, config);
	assert.match(captured, /line-2/);
	assert.match(captured, /line-4/);
	assert.doesNotMatch(captured, /line-1/);

	const huge = "x".repeat(200);
	const truncated = captureWorkerOutputTail(huge, config);
	assert.match(truncated, /worker output truncated/);
});

test("redactWorkerOutput applies built-in and config deny patterns", () => {
	const config = resolveWorkerOutputConfig({
		lanes: { workerOutputDenyPatterns: ["CUSTOM_SECRET_\\d+"] },
	});
	const text =
		"DATABASE_URL=postgres://user:pass@host/db token=abc123 CUSTOM_SECRET_999";
	const redacted = redactWorkerOutput(text, config);
	assert.match(redacted, /\[REDACTED\]/g);
	assert.doesNotMatch(redacted, /postgres:\/\/user:pass/);
	assert.doesNotMatch(redacted, /CUSTOM_SECRET_999/);
});

test("runWorker stall_timeout captures stderr, persists log, journals stall_killed", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stall-out-"));
	const batchId = "20260603T120000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskFolder = path.join(worktreePath, "spine-tasks", "SP-056-test");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = "120000";
	process.env.SPINE_WORKER_STUB_OUTPUT = "hung worker diagnostic stderr";

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 2,
			taskId: "SP-056",
			config: {
				lanes: {
					stallTimeoutMinutes: 0.02,
					stallGraceAfterProgressMinutes: 0.01,
					heartbeatIntervalMinutes: 60,
				},
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "stall_timeout");
		assert.match(result.output, /hung worker diagnostic/);

		const logPath = workerOutputLogPath(projectRoot, batchId, 2, "SP-056");
		assert.ok(fs.existsSync(logPath), "worker output log should exist on disk");

		const events = readJournalEvents(projectRoot, batchId);
		const stallKilled = events.find((event) => event.type === "lane.stall_killed");
		assert.ok(stallKilled, "lane.stall_killed should be journaled");
		assert.equal(stallKilled.payload?.exitCode, 124);
		assert.match(String(stallKilled.payload?.logPath), /worker-output-SP-056\.log/);

		const hints = extractJournalDiagnosisHints(events);
		assert.ok(hints.some((hint) => hint.type === "lane.stall_killed"));
		const summary = summarizeJournalEvent(stallKilled);
		assert.match(summary, /worker-output-SP-056\.log/);
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

test("collectEvidenceBundle references persisted worker output logs", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stall-ev-"));
	const batchId = "20260603T130000";
	const projectRoot = path.join(root, "project");
	const logPath = workerOutputLogPath(projectRoot, batchId, 1, "TP-001");
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	fs.writeFileSync(logPath, "worker tail\n", "utf-8");

	try {
		const bundle = collectEvidenceBundle({ projectRoot, batchId, batchState: null, config: null });
		assert.ok(
			bundle.evidenceRefs.some((ref) => ref.endsWith("worker-output-TP-001.log")),
			"gate evidence should reference worker output log",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("successful worker skips log unless retainWorkerOutputOnSuccess", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stall-ok-"));
	const batchId = "20260603T140000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskFolder = path.join(worktreePath, "spine-tasks", "TP-901-ok");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId: "TP-901",
			config: { lanes: { retainWorkerOutputOnSuccess: false } },
		});
		assert.equal(result.ok, true);
		assert.equal(
			fs.existsSync(workerOutputLogPath(projectRoot, batchId, 1, "TP-901")),
			false,
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});
