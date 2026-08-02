import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	buildHeartbeatPayloadFields,
	buildProgressSnapshotPayload,
	collectProgressSignals,
	findLatestSubprocessSignal,
	recordLaneHeartbeat,
	redactSubprocessCommand,
	resolveEffectiveWorkerPhase,
} from "../../src/batch/heartbeat.mjs";
import {
	enrichLaneRowsWithSubprocessHeartbeat,
	formatSubprocessHeartbeatDisplay,
	resolveSubprocessHeartbeatMeta,
} from "../../src/dashboard/snapshot.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";

test("redactSubprocessCommand maps friendly labels and redacts secrets", () => {
	assert.equal(redactSubprocessCommand("npm test -- tests/foo.mjs"), "tests");
	assert.equal(redactSubprocessCommand("npm run typecheck"), "typecheck");
	assert.equal(redactSubprocessCommand("npm run coverage:check"), "coverage");
	assert.equal(
		redactSubprocessCommand("SPINE_API_KEY=sk-live-abcdef npm run coverage:check"),
		"coverage",
	);
	assert.equal(
		redactSubprocessCommand("node --test tests/batch/heartbeat-subprocess.test.mjs"),
		"tests",
	);
});

test("findLatestSubprocessSignal returns active subprocess and respects ended marker", () => {
	const events = [
		{
			type: "task.subprocess_active",
			taskId: "SP-548",
			laneId: "lane-2",
			timestamp: "2026-07-08T19:25:00.000Z",
			payload: { subprocessCommand: "npm test" },
		},
		{
			type: "task.subprocess_ended",
			taskId: "SP-548",
			laneId: "lane-2",
			timestamp: "2026-07-08T19:30:00.000Z",
			payload: {},
		},
	];
	const active = findLatestSubprocessSignal(events, { laneNumber: 2, taskId: "SP-548" });
	assert.equal(active, null);

	const stillRunning = findLatestSubprocessSignal(
		events.slice(0, 1),
		{ laneNumber: 2, taskId: "SP-548" },
	);
	assert.equal(stillRunning?.subprocessCommand, "tests");
});

test("collectProgressSignals includes subprocess from journal without extra git polling", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hb-subprocess-"));
	const batchId = "20260708T190000";
	const taskFolder = path.join(projectRoot, "spine-tasks", "SP-548");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "step 4", "utf-8");

	appendJournalEvent(projectRoot, batchId, "task.subprocess_active", {
		taskId: "SP-548",
		laneNumber: 2,
		subprocessCommand: "npm run typecheck",
	});

	const signals = collectProgressSignals({
		worktreePath: projectRoot,
		taskFolder,
		journalContext: { projectRoot, batchId, laneNumber: 2, taskId: "SP-548" },
	});
	assert.equal(signals.subprocessCommand, "typecheck");
	assert.ok(signals.subprocessStartedAtMs);

	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("recordLaneHeartbeat journals subprocess phase and command", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hb-subprocess-journal-"));
	const batchId = "20260708T191000";
	const taskFolder = path.join(projectRoot, "spine-tasks", "SP-548");
	fs.mkdirSync(taskFolder, { recursive: true });

	appendJournalEvent(projectRoot, batchId, "task.subprocess_active", {
		taskId: "SP-548",
		laneNumber: 1,
		subprocessCommand: "npm test",
	});

	const signals = collectProgressSignals({
		worktreePath: projectRoot,
		taskFolder,
		journalContext: { projectRoot, batchId, laneNumber: 1, taskId: "SP-548" },
	});

	recordLaneHeartbeat({
		projectRoot,
		batchId,
		laneNumber: 1,
		taskId: "SP-548",
		signals,
		correlationId: "corr-subprocess",
		workerPhase: "pi",
		heartbeatKind: "worker_alive",
	});

	const events = readJournalEvents(projectRoot, batchId);
	const heartbeat = events.find((event) => event.type === "lane.heartbeat");
	assert.ok(heartbeat);
	assert.equal(heartbeat.payload.workerPhase, "subprocess");
	assert.equal(heartbeat.payload.subprocessCommand, "tests");
	assert.ok(heartbeat.payload.subprocessStartedAtMs);

	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("buildHeartbeatPayloadFields includes subprocess summary on worker_alive", () => {
	const signals = {
		subprocessCommand: "coverage",
		subprocessStartedAtMs: Date.now() - 180_000,
		dirtyPaths: [],
	};
	const payload = buildHeartbeatPayloadFields(signals, "pi", "worker_alive");
	assert.equal(payload.subprocessCommand, "coverage");
	assert.ok(payload.subprocessStartedAtMs);
	assert.equal(payload.dirtyPathCount, 0);
});

test("resolveEffectiveWorkerPhase prefers subprocess when signal present", () => {
	assert.equal(
		resolveEffectiveWorkerPhase("pi", { subprocessCommand: "tests" }),
		"subprocess",
	);
	assert.equal(resolveEffectiveWorkerPhase("pi", { dirtyPaths: [] }), "pi");
});

test("buildProgressSnapshotPayload carries subprocess fields", () => {
	const snapshot = buildProgressSnapshotPayload(
		{ subprocessCommand: "typecheck", subprocessStartedAtMs: 1, dirtyPaths: [] },
		"pi",
	);
	assert.equal(snapshot.workerPhase, "subprocess");
	assert.equal(snapshot.subprocessCommand, "typecheck");
});

test("snapshot helpers format subprocess heartbeat display", () => {
	const startedAt = Date.parse("2026-07-08T19:25:00.000Z");
	const display = formatSubprocessHeartbeatDisplay({
		subprocessCommand: "tests",
		subprocessStartedAtMs: startedAt,
		now: startedAt + 3 * 60 * 1000,
	});
	assert.equal(display, "running tests (3m)");

	const events = [
		{
			type: "lane.heartbeat",
			timestamp: "2026-07-08T19:33:00.000Z",
			payload: {
				laneNumber: 3,
				workerPhase: "subprocess",
				subprocessCommand: "coverage",
				subprocessStartedAtMs: startedAt,
			},
		},
	];
	const meta = resolveSubprocessHeartbeatMeta(3, events);
	assert.equal(meta.workerPhase, "subprocess");
	assert.equal(meta.subprocessCommand, "coverage");

	const lanes = enrichLaneRowsWithSubprocessHeartbeat(
		[
			{
				laneNumber: 3,
				workerPhase: "pi",
				heartbeatDisplay: "600s",
			},
		],
		events,
		startedAt + 5 * 60 * 1000,
	);
	assert.equal(lanes[0]?.heartbeatDisplay, "running coverage (5m)");
	assert.equal(lanes[0]?.workerPhase, "subprocess");
});
