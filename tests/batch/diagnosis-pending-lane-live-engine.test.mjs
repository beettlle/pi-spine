/**
 * SP-815 — no pending_lane_land / salvage recommendation while the batch
 * engine is alive and the raw batch state still shows a running phase or a
 * running task (#330).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	isLiveEngineMidTask,
	shouldDiagnosePendingLaneLand,
} from "../../src/batch/diagnosis-pending-lane.mjs";
import { deriveDiagnosis } from "../../src/batch/reconcile-diagnosis.mjs";

/** Batch state from #330: engine alive, phase running, SP-276 mid final review. */
const ISSUE_330_RAW = {
	batchId: "20260928T231505-8eee",
	phase: "running",
	resilience: { enginePid: 49095 },
	tasks: [
		{ taskId: "SP-252", status: "succeeded" },
		{ taskId: "SP-276", status: "running" },
	],
};

/** Reconciled signals from #330: every task looks terminal-success. */
const ISSUE_330_SIGNALS = {
	phase: "running",
	endedAt: null,
	failedTasks: 0,
	allTasksTerminalSuccess: true,
	hasRunningTasks: false,
	hasPendingTasks: false,
	hasFailedTasks: false,
	hasSegmentDrift: false,
	mergeResultsEmpty: false,
	git: { orchMergedToBase: true, orchBranchExists: true, orchCommitsAhead: null },
	tasks: [
		{
			taskId: "SP-252",
			status: "succeeded",
			classification: "terminal-success",
			doneInLane: true,
			doneOnMain: false,
			laneNumber: 1,
		},
		{
			taskId: "SP-276",
			status: "succeeded",
			classification: "terminal-success",
			doneInLane: true,
			doneOnMain: false,
			laneNumber: 1,
		},
	],
	raw: ISSUE_330_RAW,
};

test("#330 shape with live engine suppresses pending lane land diagnosis", () => {
	assert.equal(isLiveEngineMidTask(ISSUE_330_RAW, { isEngineAlive: () => true }), true);
	assert.equal(
		shouldDiagnosePendingLaneLand(ISSUE_330_SIGNALS, { isEngineAlive: () => true }),
		false,
	);
});

test("same shape with crashed engine still gets salvage guidance", () => {
	assert.equal(isLiveEngineMidTask(ISSUE_330_RAW, { isEngineAlive: () => false }), false);
	assert.equal(
		shouldDiagnosePendingLaneLand(ISSUE_330_SIGNALS, { isEngineAlive: () => false }),
		true,
	);
});

test("engine alive but raw state terminal does not suppress the diagnosis", () => {
	const terminalRaw = {
		phase: "completed",
		resilience: { enginePid: 49095 },
		tasks: [{ taskId: "SP-276", status: "succeeded" }],
	};
	const signals = { ...ISSUE_330_SIGNALS, phase: "completed", raw: terminalRaw };
	assert.equal(isLiveEngineMidTask(terminalRaw, { isEngineAlive: () => true }), false);
	assert.equal(shouldDiagnosePendingLaneLand(signals, { isEngineAlive: () => true }), true);
});

test("stateDrift.drifted with live engine and running task is also suppressed", () => {
	const driftedSignals = {
		...ISSUE_330_SIGNALS,
		allTasksTerminalSuccess: false,
		stateDrift: { drifted: true },
	};
	assert.equal(
		shouldDiagnosePendingLaneLand(driftedSignals, { isEngineAlive: () => true }),
		false,
	);
	// Crashed engine keeps the drifted salvage guidance.
	assert.equal(
		shouldDiagnosePendingLaneLand(driftedSignals, { isEngineAlive: () => false }),
		true,
	);
});

test("deriveDiagnosis on #330 signals with a live current-process PID is not pending_lane_land", () => {
	const signals = {
		...ISSUE_330_SIGNALS,
		raw: {
			...ISSUE_330_RAW,
			resilience: { enginePid: process.pid },
		},
	};
	const derived = deriveDiagnosis(signals);
	assert.notEqual(derived.diagnosis, "pending_lane_land");
	assert.equal(derived.diagnosis, "running");
});
