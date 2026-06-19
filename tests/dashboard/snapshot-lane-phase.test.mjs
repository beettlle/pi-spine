import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveLaneActivityPhase,
	buildLaneRows,
} from "../../src/dashboard/snapshot.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";

const classifiedRunning = [
	{ taskId: "TP-001", laneNumber: 1, status: "running", classification: "running" },
];

test("resolveLaneActivityPhase: heartbeat pi → worker", () => {
	const result = resolveLaneActivityPhase({
		laneNumber: 1,
		activeTaskIds: ["TP-001"],
		classifiedTasks: classifiedRunning,
		journalEvents: [
			{
				type: "lane.heartbeat",
				laneId: "lane-1",
				payload: { laneNumber: 1, workerPhase: "pi" },
			},
		],
	});
	assert.equal(result.activityPhase, "worker");
	assert.equal(result.activityPhaseLabel, "worker");
});

test("resolveLaneActivityPhase: open code review.started → code review", () => {
	const result = resolveLaneActivityPhase({
		laneNumber: 1,
		activeTaskIds: ["TP-001"],
		classifiedTasks: classifiedRunning,
		journalEvents: [
			{
				type: "lane.heartbeat",
				laneId: "lane-1",
				payload: { laneNumber: 1, workerPhase: "pi" },
			},
			{
				type: "review.started",
				laneId: "lane-1",
				taskId: "TP-001",
				payload: { laneNumber: 1, reviewType: "code", stepNumber: 2 },
			},
		],
	});
	assert.equal(result.activityPhase, "code_review");
	assert.equal(result.activityPhaseLabel, "code review");
});

test("resolveLaneActivityPhase: open final review.started → final review", () => {
	const result = resolveLaneActivityPhase({
		laneNumber: 1,
		activeTaskIds: ["TP-001"],
		classifiedTasks: classifiedRunning,
		journalEvents: [
			{
				type: "review.started",
				laneId: "lane-1",
				taskId: "TP-001",
				payload: { laneNumber: 1, reviewType: "final", stepNumber: 4 },
			},
		],
	});
	assert.equal(result.activityPhase, "final_review");
	assert.equal(result.activityPhaseLabel, "final review");
});

test("resolveLaneActivityPhase: closed review.started falls through to worker heartbeat", () => {
	const result = resolveLaneActivityPhase({
		laneNumber: 1,
		activeTaskIds: ["TP-001"],
		classifiedTasks: classifiedRunning,
		journalEvents: [
			{
				type: "review.started",
				laneId: "lane-1",
				taskId: "TP-001",
				payload: { laneNumber: 1, reviewType: "code", stepNumber: 2 },
			},
			{
				type: "review.completed",
				laneId: "lane-1",
				taskId: "TP-001",
				payload: { laneNumber: 1, reviewType: "code", stepNumber: 2, verdict: "APPROVE" },
			},
			{
				type: "lane.heartbeat",
				laneId: "lane-1",
				payload: { laneNumber: 1, workerPhase: "pi" },
			},
		],
	});
	assert.equal(result.activityPhase, "worker");
});

test("resolveLaneActivityPhase: lane.completed code_rework → rework", () => {
	const result = resolveLaneActivityPhase({
		laneNumber: 1,
		activeTaskIds: ["TP-001"],
		classifiedTasks: classifiedRunning,
		journalEvents: [
			{
				type: "lane.completed",
				laneId: "lane-1",
				taskId: "TP-001",
				payload: { laneNumber: 1, phase: "code_rework" },
			},
		],
	});
	assert.equal(result.activityPhase, "rework");
	assert.equal(result.activityPhaseLabel, "rework");
});

test("resolveLaneActivityPhase: no active tasks → em dash", () => {
	const result = resolveLaneActivityPhase({
		laneNumber: 1,
		activeTaskIds: [],
		classifiedTasks: [],
		journalEvents: [
			{
				type: "lane.heartbeat",
				laneId: "lane-1",
				payload: { laneNumber: 1, workerPhase: "pi" },
			},
		],
	});
	assert.equal(result.activityPhase, "idle");
	assert.equal(result.activityPhaseLabel, "—");
});

test("buildLaneRows exposes activityPhase fields", () => {
	const stallConfig = resolveStallConfig({});
	const rows = buildLaneRows({
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-001"], lastHeartbeatAt: Date.now() },
		],
		classifiedTasks: classifiedRunning,
		stallConfig,
		currentWaveTaskIds: ["TP-001"],
		journalEvents: [
			{
				type: "lane.heartbeat",
				laneId: "lane-1",
				payload: { laneNumber: 1, workerPhase: "pi" },
			},
		],
	});
	assert.equal(rows[0].activityPhase, "worker");
	assert.equal(rows[0].activityPhaseLabel, "worker");
});
