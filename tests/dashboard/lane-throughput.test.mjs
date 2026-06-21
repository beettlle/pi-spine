import assert from "node:assert/strict";
import test from "node:test";
import {
	computeThroughputTasksPerHour,
	deriveLaneThroughputStats,
	formatElapsedMs,
	formatThroughputRate,
	summarizeLaneThroughput,
} from "../../src/dashboard/lane-throughput.mjs";

const BASE_TS = Date.parse("2026-06-20T12:00:00.000Z");

test("deriveLaneThroughputStats counts completed tasks from journal", () => {
	const statsByLane = deriveLaneThroughputStats({
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001", "TP-002"] }],
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
				timestamp: new Date(BASE_TS + 30 * 60 * 1000).toISOString(),
			},
			{
				type: "task.started",
				laneId: "lane-1",
				taskId: "TP-002",
				timestamp: new Date(BASE_TS + 35 * 60 * 1000).toISOString(),
			},
			{
				type: "task.failed",
				laneId: "lane-1",
				taskId: "TP-002",
				timestamp: new Date(BASE_TS + 50 * 60 * 1000).toISOString(),
			},
		],
		now: BASE_TS + 60 * 60 * 1000,
	});

	const lane1 = statsByLane.get(1);
	assert.ok(lane1);
	assert.equal(lane1.completedCount, 1);
	assert.equal(lane1.failedCount, 1);
	assert.equal(lane1.activeElapsedMs, 45 * 60 * 1000);
	assert.equal(lane1.throughputTasksPerHour, 4 / 3);
});

test("deriveLaneThroughputStats prefers run-metrics durationMs when present", () => {
	const statsByLane = deriveLaneThroughputStats({
		lanes: [{ laneNumber: 2, laneId: "lane-2", taskIds: ["TP-010"] }],
		journalEvents: [
			{
				type: "task.started",
				laneId: "lane-2",
				taskId: "TP-010",
				timestamp: new Date(BASE_TS).toISOString(),
			},
			{
				type: "task.completed",
				laneId: "lane-2",
				taskId: "TP-010",
				timestamp: new Date(BASE_TS + 10 * 60 * 1000).toISOString(),
			},
		],
		metricsLines: [
			{
				recordType: "task",
				taskId: "TP-010",
				laneNumber: 2,
				durationMs: 20 * 60 * 1000,
				outcome: "completed",
			},
		],
	});

	const lane2 = statsByLane.get(2);
	assert.equal(lane2?.activeElapsedMs, 20 * 60 * 1000);
	assert.equal(lane2?.throughputTasksPerHour, 3);
});

test("formatElapsedMs and formatThroughputRate render dashboard values", () => {
	assert.equal(formatElapsedMs(45_000), "45s");
	assert.equal(formatElapsedMs(90 * 60 * 1000), "1h 30m");
	assert.equal(formatThroughputRate(2.44), "2.4");
	assert.equal(formatThroughputRate(null), "—");
});

test("summarizeLaneThroughput aggregates multi-lane stats", () => {
	const statsByLane = deriveLaneThroughputStats({
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001"] },
			{ laneNumber: 2, laneId: "lane-2", taskIds: ["TP-002"] },
		],
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
			{
				type: "task.started",
				laneId: "lane-2",
				taskId: "TP-002",
				timestamp: new Date(BASE_TS).toISOString(),
			},
			{
				type: "task.completed",
				laneId: "lane-2",
				taskId: "TP-002",
				timestamp: new Date(BASE_TS + 30 * 60 * 1000).toISOString(),
			},
		],
	});

	const summary = summarizeLaneThroughput(statsByLane);
	assert.equal(summary.completedCount, 2);
	assert.equal(summary.activeElapsedMs, 90 * 60 * 1000);
	assert.equal(computeThroughputTasksPerHour(summary.completedCount, summary.activeElapsedMs), 4 / 3);
});
