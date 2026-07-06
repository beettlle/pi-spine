import assert from "node:assert/strict";
import test from "node:test";
import {
	buildLaneRows,
	computeActiveTaskIdsForLane,
	computeQueuedTaskIdsForLane,
	computeRunningTaskIdForLane,
} from "../../src/dashboard/snapshot-lanes.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";

const BASE_TS = Date.parse("2026-06-20T12:00:00.000Z");

test("computeActiveTaskIdsForLane returns running/pending tasks in current wave only", () => {
	const classifiedTasks = [
		{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
		{ taskId: "TP-002", laneNumber: 1, status: "running", classification: "running" },
		{ taskId: "TP-003", laneNumber: 2, status: "pending", classification: "pending" },
	];
	const lane = { laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001", "TP-002"] };

	assert.deepEqual(
		computeActiveTaskIdsForLane({
			lane,
			classifiedTasks,
			currentWaveTaskIds: ["TP-002", "TP-003"],
		}),
		["TP-002"],
	);
});

test("computeRunningTaskIdForLane returns at most one running task in current wave", () => {
	const classifiedTasks = [
		{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
		{ taskId: "TP-002", laneNumber: 1, status: "running", classification: "running" },
		{ taskId: "TP-003", laneNumber: 1, status: "pending", classification: "pending" },
	];
	const lane = { laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001", "TP-002", "TP-003"] };

	assert.equal(
		computeRunningTaskIdForLane({
			lane,
			classifiedTasks,
			currentWaveTaskIds: ["TP-002", "TP-003"],
		}),
		"TP-002",
	);
	assert.equal(
		computeRunningTaskIdForLane({
			lane,
			classifiedTasks: [
				{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
			],
			currentWaveTaskIds: ["TP-001"],
		}),
		null,
	);
});

test("computeQueuedTaskIdsForLane returns pending tasks in lane.taskIds order", () => {
	const classifiedTasks = [
		{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
		{ taskId: "TP-002", laneNumber: 1, status: "running", classification: "running" },
		{ taskId: "TP-003", laneNumber: 1, status: "pending", classification: "pending" },
		{ taskId: "TP-004", laneNumber: 1, status: "pending", classification: "pending" },
	];
	const lane = { laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001", "TP-004", "TP-002", "TP-003"] };

	assert.deepEqual(
		computeQueuedTaskIdsForLane({
			lane,
			classifiedTasks,
			currentWaveTaskIds: ["TP-002", "TP-003", "TP-004"],
		}),
		["TP-004", "TP-003"],
	);
});

test("buildLaneRows exposes runningTaskId, queuedTaskIds, and deprecated activeTaskIds union", () => {
	const stallConfig = resolveStallConfig({});
	const rows = buildLaneRows({
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				taskIds: ["TP-001", "TP-002", "TP-003", "TP-004"],
				lastHeartbeatAt: Date.now(),
			},
		],
		classifiedTasks: [
			{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
			{ taskId: "TP-002", laneNumber: 1, status: "running", classification: "running" },
			{ taskId: "TP-003", laneNumber: 1, status: "pending", classification: "pending" },
			{ taskId: "TP-004", laneNumber: 1, status: "pending", classification: "pending" },
		],
		stallConfig,
		currentWaveTaskIds: ["TP-002", "TP-003", "TP-004"],
	});

	assert.equal(rows[0].runningTaskId, "TP-002");
	assert.deepEqual(rows[0].queuedTaskIds, ["TP-003", "TP-004"]);
	assert.deepEqual(rows[0].activeTaskIds, ["TP-002", "TP-003", "TP-004"]);
});

test("buildLaneRows exposes activeTaskIds separate from batch assignment", () => {
	const stallConfig = resolveStallConfig({});
	const rows = buildLaneRows({
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001", "TP-002"], lastHeartbeatAt: Date.now() },
			{ laneNumber: 2, laneId: "lane-2", taskIds: ["TP-003"], lastHeartbeatAt: Date.now() },
		],
		classifiedTasks: [
			{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
			{ taskId: "TP-002", laneNumber: 1, status: "running", classification: "running" },
			{ taskId: "TP-003", laneNumber: 2, status: "pending", classification: "pending" },
		],
		stallConfig,
		currentWaveTaskIds: ["TP-002", "TP-003"],
	});

	assert.deepEqual(rows[0].activeTaskIds, ["TP-002"]);
	assert.equal(rows[0].runningTaskId, "TP-002");
	assert.deepEqual(rows[0].queuedTaskIds, []);
	assert.deepEqual(rows[0].taskIds, ["TP-001", "TP-002"]);
	assert.deepEqual(rows[1].activeTaskIds, ["TP-003"]);
	assert.equal(rows[1].runningTaskId, null);
	assert.deepEqual(rows[1].queuedTaskIds, ["TP-003"]);
});

test("buildLaneRows attaches per-lane throughput stats from journal", () => {
	const stallConfig = resolveStallConfig({});
	const rows = buildLaneRows({
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001"], lastHeartbeatAt: Date.now() }],
		classifiedTasks: [
			{ taskId: "TP-001", laneNumber: 1, status: "succeeded", classification: "terminal-success" },
		],
		stallConfig,
		currentWaveTaskIds: [],
		journalEvents: [
			{
				type: "task.started",
				laneId: "lane-1",
				taskId: "TP-001",
				timestamp: new Date(BASE_TS).toISOString(),
			},
			{
				type: "task.completed",
				laneId: "lane-1",
				taskId: "TP-001",
				timestamp: new Date(BASE_TS + 60 * 60 * 1000).toISOString(),
			},
		],
	});

	assert.equal(rows[0].throughput.completedCount, 1);
	assert.equal(rows[0].throughput.activeElapsedMs, 60 * 60 * 1000);
	assert.equal(rows[0].throughput.throughputTasksPerHour, 1);
});
