import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	computeStallDeadline,
	resolveStallConfig,
} from "../../src/batch/heartbeat.mjs";
import {
	nextStallAnchorAt,
	shouldSlideStallAnchorOnHeartbeat,
} from "../../src/batch/engine-lanes/watch.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

function writeMinimalPrompt(taskFolder, taskId) {
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId}\n\n## Review Level: 0\n\n## Mission\nHeartbeat slide.\n`,
		"utf-8",
	);
}

test("shouldSlideStallAnchorOnHeartbeat only slides worker_alive in pi phase", () => {
	assert.equal(
		shouldSlideStallAnchorOnHeartbeat({ workerPhase: "pi", heartbeatKind: "worker_alive" }),
		true,
	);
	assert.equal(
		shouldSlideStallAnchorOnHeartbeat({ workerPhase: "launching", heartbeatKind: "worker_alive" }),
		false,
	);
	assert.equal(
		shouldSlideStallAnchorOnHeartbeat({ workerPhase: "pi", heartbeatKind: "checkpoint" }),
		false,
	);
});

test("computeStallDeadline slides silent stall window when lastAliveAt advances", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 2, stallGraceAfterProgressMinutes: 5 },
	});
	const startedAt = 0;
	const lastProgressAt = 0;
	const initialAnchor = startedAt;
	const slidAnchor = 90 * 60 * 1000;

	const beforeHeartbeat = computeStallDeadline({
		startedAt,
		lastProgressAt,
		lastAliveAt: initialAnchor,
		stallConfig,
	});
	const afterHeartbeat = computeStallDeadline({
		startedAt,
		lastProgressAt,
		lastAliveAt: slidAnchor,
		stallConfig,
	});

	const silentBefore = initialAnchor + stallConfig.stallTimeoutMs;
	const silentAfter = slidAnchor + stallConfig.stallTimeoutMs;
	assert.equal(beforeHeartbeat, Math.max(silentBefore, lastProgressAt + stallConfig.graceAfterProgressMs));
	assert.equal(afterHeartbeat, Math.max(silentAfter, lastProgressAt + stallConfig.graceAfterProgressMs));
	assert.ok(afterHeartbeat > beforeHeartbeat);
});

test("nextStallAnchorAt advances only on pi worker_alive", () => {
	const anchor = nextStallAnchorAt({
		stallAnchorAt: 100,
		now: 200,
		workerPhase: "pi",
		heartbeatKind: "worker_alive",
	});
	assert.equal(anchor, 200);

	const unchanged = nextStallAnchorAt({
		stallAnchorAt: 100,
		now: 200,
		workerPhase: "launching",
		heartbeatKind: "worker_alive",
	});
	assert.equal(unchanged, 100);
});

test("runWorker worker_alive heartbeats extend stall deadline past initial window", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hb-slide-"));
	const batchId = "20260630T161500";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-341-slide";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-active`);
	fs.mkdirSync(taskFolder, { recursive: true });
	writeMinimalPrompt(taskFolder, taskId);

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = "8000";
	process.env.SPINE_WORKER_STUB_OUTPUT = "active hang with heartbeats";

	const stallTimeoutMs = 3_000;

	try {
		const startedAt = Date.now();
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId,
			config: {
				lanes: {
					stallTimeoutMinutes: stallTimeoutMs / 60_000,
					stallGraceAfterProgressMinutes: 1,
					heartbeatIntervalMinutes: 0.01,
					postDoneGraceMinutes: 5,
				},
			},
		});
		const elapsedMs = Date.now() - startedAt;

		assert.ok(elapsedMs > stallTimeoutMs, "worker should survive past initial stall window");
		assert.notEqual(result.classification, "stall_timeout");
		assert.equal(result.doneFound, false);

		const events = readJournalEvents(projectRoot, batchId);
		const heartbeats = events.filter(
			(event) =>
				event.type === "lane.heartbeat" &&
				event.payload?.heartbeatKind === "worker_alive" &&
				event.payload?.workerPhase === "pi",
		);
		assert.ok(heartbeats.length >= 2, "expected multiple pi worker_alive heartbeats");
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

test("runWorker silent stall still fails without heartbeats", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hb-silent-"));
	const batchId = "20260630T161600";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-341-silent";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-stall`);
	fs.mkdirSync(taskFolder, { recursive: true });
	writeMinimalPrompt(taskFolder, taskId);

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = "120000";
	process.env.SPINE_WORKER_STUB_OUTPUT = "silent hang without heartbeats";

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
					stallTimeoutMinutes: 0.02,
					stallGraceAfterProgressMinutes: 0.01,
					heartbeatIntervalMinutes: 60,
					postDoneGraceMinutes: 5,
				},
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "stall_timeout");
		assert.equal(result.doneFound, false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "lane.stall_warning"));
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
