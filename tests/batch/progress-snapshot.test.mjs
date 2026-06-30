import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import {
	buildProgressSnapshotPayload,
	collectProgressSignals,
	progressSnapshotPayloadChanged,
	recordLaneProgressSnapshot,
	resolveStallConfig,
	shouldEmitProgressSnapshot,
} from "../../src/batch/heartbeat.mjs";
import { MAX_PAYLOAD_BYTES, readJournalEvents, summarizeJournalEvent } from "../../src/batch/journal.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

test("resolveStallConfig defaults progressSnapshotIntervalMinutes to 2", () => {
	const cfg = resolveStallConfig({});
	assert.equal(cfg.progressSnapshotIntervalMs, 2 * 60 * 1000);
});

test("resolveStallConfig applies progressSnapshotIntervalMinutes override", () => {
	const cfg = resolveStallConfig({ lanes: { progressSnapshotIntervalMinutes: 5 } });
	assert.equal(cfg.progressSnapshotIntervalMs, 5 * 60 * 1000);
});

test("buildProgressSnapshotPayload is bounded and omits dirty path lists", () => {
	const signals = {
		statusMtimeMs: 100,
		lastCommitAtMs: 200,
		stepCompletedAtMs: 300,
		dirtyPaths: ["src/a.mjs", "src/b.mjs"],
	};
	const payload = buildProgressSnapshotPayload(signals, "pi");
	assert.deepEqual(payload, {
		workerPhase: "pi",
		dirtyPathCount: 2,
		lastCommitAtMs: 200,
		statusMtimeMs: 100,
		stepCompletedAtMs: 300,
	});
	assert.equal("dirtyPaths" in payload, false);
	const serialized = JSON.stringify(payload);
	assert.ok(Buffer.byteLength(serialized, "utf-8") < MAX_PAYLOAD_BYTES);
});

test("progressSnapshotPayloadChanged detects field deltas", () => {
	const base = buildProgressSnapshotPayload(
		{ dirtyPaths: [], statusMtimeMs: 1, lastCommitAtMs: null, stepCompletedAtMs: null },
		"pi",
	);
	assert.equal(progressSnapshotPayloadChanged(null, base), true);
	assert.equal(progressSnapshotPayloadChanged(base, base), false);
	const statusBump = buildProgressSnapshotPayload(
		{ dirtyPaths: [], statusMtimeMs: 2, lastCommitAtMs: null, stepCompletedAtMs: null },
		"pi",
	);
	assert.equal(progressSnapshotPayloadChanged(base, statusBump), true);
});

test("shouldEmitProgressSnapshot respects interval", () => {
	assert.equal(
		shouldEmitProgressSnapshot({ now: 500, lastEmittedAt: 0, intervalMs: 600 }),
		false,
	);
	assert.equal(
		shouldEmitProgressSnapshot({ now: 600, lastEmittedAt: 0, intervalMs: 600 }),
		true,
	);
});

test("recordLaneProgressSnapshot journals bounded payload", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("."), "snap-"));
	const batchId = "20260629T120000";
	const signals = collectProgressSignals({
		worktreePath: projectRoot,
		taskFolder: projectRoot,
	});
	recordLaneProgressSnapshot({
		projectRoot,
		batchId,
		laneNumber: 1,
		taskId: "SP-364",
		signals,
		correlationId: "corr-snap",
		workerPhase: "pi",
	});
	const events = readJournalEvents(projectRoot, batchId);
	const snapshot = events.find((event) => event.type === "lane.progress_snapshot");
	assert.ok(snapshot);
	assert.equal(snapshot.payload.workerPhase, "pi");
	assert.equal(snapshot.payload.dirtyPathCount, 0);
	assert.equal("dirtyPaths" in snapshot.payload, false);
	const summary = summarizeJournalEvent(snapshot);
	assert.match(summary, /phase pi/);
	assert.match(summary, /0 dirty path/);
	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("runWorker emits lane.progress_snapshot on interval and dedupes unchanged signals", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-snap-"));
	const batchId = "20260629T130000";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskFolder = path.join(worktreePath, "spine-tasks", "SP-364-test");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\ninitial\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = "15000";

	const touchTimer = setTimeout(() => {
		fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\nupdated\n", "utf-8");
	}, 2500);

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId: "SP-364",
			config: {
				lanes: {
					progressSnapshotIntervalMinutes: 0.01,
					heartbeatIntervalMinutes: 60,
					stallTimeoutMinutes: 0.1,
					stallGraceAfterProgressMinutes: 0.05,
				},
			},
		});

		assert.equal(result.classification, "stall_timeout");

		const events = readJournalEvents(projectRoot, batchId);
		const snapshots = events.filter((event) => event.type === "lane.progress_snapshot");
		assert.ok(snapshots.length >= 2, `expected >=2 snapshots, got ${snapshots.length}`);
		const statusTimes = snapshots.map((event) => event.payload.statusMtimeMs);
		assert.ok(
			statusTimes.some((value, index) => index > 0 && value !== statusTimes[0]),
			"expected a snapshot after STATUS change",
		);
		for (const snapshot of snapshots) {
			assert.equal("dirtyPaths" in snapshot.payload, false);
			assert.ok(snapshot.payload.workerPhase);
		}
	} finally {
		clearTimeout(touchTimer);
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevHang === undefined) delete process.env.SPINE_WORKER_STUB_HANG_MS;
		else process.env.SPINE_WORKER_STUB_HANG_MS = prevHang;
		await rm(root, { recursive: true, force: true });
	}
});
