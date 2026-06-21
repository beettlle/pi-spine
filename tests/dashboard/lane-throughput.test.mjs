import assert from "node:assert/strict";
import test from "node:test";
import {
	computeThroughputTasksPerHour,
	deriveLaneThroughputStats,
	deriveLanesThroughput,
	emptyLaneThroughputStats,
} from "../../src/dashboard/lane-throughput.mjs";

const T0 = Date.parse("2026-06-20T12:00:00.000Z");
const MIN = 60_000;

function journalEvent(type, { taskId, laneNumber, timestampMs, laneId }) {
	return {
		type,
		timestamp: new Date(timestampMs).toISOString(),
		taskId,
		laneId: laneId ?? (laneNumber != null ? `lane-${laneNumber}` : undefined),
		payload: laneNumber != null ? { laneNumber } : {},
	};
}

test("emptyLaneThroughputStats returns zeroed task-based fields", () => {
	assert.deepEqual(emptyLaneThroughputStats(), {
		activeElapsedMs: 0,
		completedCount: 0,
		failedCount: 0,
		throughputTasksPerHour: 0,
	});
});

test("computeThroughputTasksPerHour is task-based and guards zero elapsed", () => {
	assert.equal(computeThroughputTasksPerHour(0, MIN), 0);
	assert.equal(computeThroughputTasksPerHour(2, 0), 0);
	assert.equal(computeThroughputTasksPerHour(2, 2 * MIN), 60);
});

test("deriveLaneThroughputStats counts completed and failed journal events per lane", () => {
	const lane = { laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001", "TP-002"] };
	const journalEvents = [
		journalEvent("task.started", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 }),
		journalEvent("task.completed", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 + MIN }),
		journalEvent("task.started", { taskId: "TP-002", laneNumber: 1, timestampMs: T0 + 2 * MIN }),
		journalEvent("task.failed", { taskId: "TP-002", laneNumber: 1, timestampMs: T0 + 3 * MIN }),
	];

	const stats = deriveLaneThroughputStats({ lane, journalEvents, now: T0 + 4 * MIN });

	assert.equal(stats.completedCount, 1);
	assert.equal(stats.failedCount, 1);
	assert.equal(stats.activeElapsedMs, 2 * MIN);
	assert.equal(stats.throughputTasksPerHour, 30);
});

test("deriveLaneThroughputStats includes open running task elapsed through now", () => {
	const lane = { laneNumber: 2, laneId: "lane-2", taskIds: ["TP-010"] };
	const journalEvents = [
		journalEvent("task.started", { taskId: "TP-010", laneNumber: 2, timestampMs: T0 }),
	];

	const stats = deriveLaneThroughputStats({
		lane,
		journalEvents,
		now: T0 + 15 * MIN,
	});

	assert.equal(stats.completedCount, 0);
	assert.equal(stats.failedCount, 0);
	assert.equal(stats.activeElapsedMs, 15 * MIN);
	assert.equal(stats.throughputTasksPerHour, 0);
});

test("deriveLaneThroughputStats prefers run-metrics duration when present", () => {
	const lane = { laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001"] };
	const journalEvents = [
		journalEvent("task.started", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 }),
		journalEvent("task.completed", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 + 10 * MIN }),
	];
	const metricsLines = [
		{
			recordType: "task",
			taskId: "TP-001",
			laneNumber: 1,
			durationMs: 5 * MIN,
			outcome: "completed",
		},
	];

	const stats = deriveLaneThroughputStats({ lane, journalEvents, metricsLines, now: T0 + 10 * MIN });

	assert.equal(stats.activeElapsedMs, 5 * MIN);
	assert.equal(stats.completedCount, 1);
	assert.equal(stats.throughputTasksPerHour, 12);
});

test("deriveLaneThroughputStats falls back to journal when metrics missing", () => {
	const lane = { laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001"] };
	const journalEvents = [
		journalEvent("task.started", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 }),
		journalEvent("task.completed", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 + 6 * MIN }),
	];

	const stats = deriveLaneThroughputStats({ lane, journalEvents, now: T0 + 6 * MIN });

	assert.equal(stats.activeElapsedMs, 6 * MIN);
	assert.equal(stats.completedCount, 1);
	assert.equal(stats.throughputTasksPerHour, 10);
});

test("deriveLaneThroughputStats maps tasks by laneNumber when lane metadata is sparse", () => {
	const lane = { laneNumber: 3, laneId: "lane-3", taskIds: [] };
	const tasks = [{ taskId: "TP-030", laneNumber: 3, status: "succeeded" }];
	const journalEvents = [
		{
			type: "task.completed",
			timestamp: new Date(T0 + 4 * MIN).toISOString(),
			taskId: "TP-030",
			payload: {},
		},
	];

	const stats = deriveLaneThroughputStats({ lane, journalEvents, tasks, now: T0 + 4 * MIN });

	assert.equal(stats.completedCount, 1);
});

test("deriveLanesThroughput returns isolated stats per lane", () => {
	const lanes = [
		{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001"] },
		{ laneNumber: 2, laneId: "lane-2", taskIds: ["TP-002", "TP-003"] },
	];
	const journalEvents = [
		journalEvent("task.started", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 }),
		journalEvent("task.completed", { taskId: "TP-001", laneNumber: 1, timestampMs: T0 + MIN }),
		journalEvent("task.started", { taskId: "TP-002", laneNumber: 2, timestampMs: T0 }),
		journalEvent("task.completed", { taskId: "TP-002", laneNumber: 2, timestampMs: T0 + 2 * MIN }),
		journalEvent("task.started", { taskId: "TP-003", laneNumber: 2, timestampMs: T0 + 3 * MIN }),
		journalEvent("task.failed", { taskId: "TP-003", laneNumber: 2, timestampMs: T0 + 4 * MIN }),
	];

	const statsByLane = deriveLanesThroughput({ lanes, journalEvents, now: T0 + 5 * MIN });

	assert.equal(statsByLane.get(1)?.completedCount, 1);
	assert.equal(statsByLane.get(1)?.failedCount, 0);
	assert.equal(statsByLane.get(2)?.completedCount, 1);
	assert.equal(statsByLane.get(2)?.failedCount, 1);
	assert.equal(statsByLane.get(2)?.activeElapsedMs, 3 * MIN);
});
