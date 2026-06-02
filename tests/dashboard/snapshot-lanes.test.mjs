import assert from "node:assert/strict";
import test from "node:test";
import {
	buildLaneRows,
	computeActiveTaskIdsForLane,
} from "../../src/dashboard/snapshot.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";

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
	assert.deepEqual(rows[0].taskIds, ["TP-001", "TP-002"]);
	assert.deepEqual(rows[1].activeTaskIds, ["TP-003"]);
});
