import assert from "node:assert/strict";
import test from "node:test";
import { buildWaveProgress } from "../../src/dashboard/snapshot-waves.mjs";
import { buildDashboardViewModel, buildWaveModel } from "../../src/dashboard/view.mjs";

const DRIFT_BATCH = {
	raw: {
		wavePlan: [["SP-101"]],
		currentWaveIndex: 0,
		totalWaves: 1,
	},
	phase: "running",
	endedAt: null,
};

const TERMINAL_SUCCESS_TASKS = [{ taskId: "SP-101", classification: "terminal-success" }];

function driftSnapshot(diagnosis) {
	const waves = buildWaveProgress(DRIFT_BATCH, TERMINAL_SUCCESS_TASKS, {
		diagnosis,
		endedAt: null,
	});
	return {
		diagnosis,
		phase: "running",
		batch: { phase: "running", endedAt: null },
		waves,
		macroPhaseLabel: "Failed",
	};
}

for (const diagnosis of ["state_drift", "engine_orphaned", "needs_retry"]) {
	test(`buildWaveProgress does not mark wave completed under ${diagnosis}`, () => {
		const waves = buildWaveProgress(DRIFT_BATCH, TERMINAL_SUCCESS_TASKS, {
			diagnosis,
			endedAt: null,
		});
		assert.equal(waves.waves.length, 1);
		assert.notEqual(waves.waves[0].status, "completed");
		assert.equal(waves.waves[0].status, "active");
	});

	test(`wave panel view model does not show completed under ${diagnosis}`, () => {
		const snapshot = driftSnapshot(diagnosis);
		const waveModel = buildWaveModel(snapshot);
		assert.equal(waveModel.waves.length, 1);
		assert.notEqual(waveModel.waves[0].status, "completed");

		const vm = buildDashboardViewModel(snapshot);
		assert.notEqual(vm.waves.waves[0].status, "completed");
	});
}

test("buildWaveProgress marks wave completed when terminal-success and diagnosis is running", () => {
	const waves = buildWaveProgress(DRIFT_BATCH, TERMINAL_SUCCESS_TASKS, {
		diagnosis: "running",
		endedAt: null,
	});
	assert.equal(waves.waves[0].status, "completed");
});

test("buildWaveProgress allows completed under drift when batch endedAt is set", () => {
	const endedBatch = { ...DRIFT_BATCH, endedAt: "2026-07-07T12:00:00.000Z" };
	const waves = buildWaveProgress(endedBatch, TERMINAL_SUCCESS_TASKS, {
		diagnosis: "state_drift",
		endedAt: endedBatch.endedAt,
	});
	assert.equal(waves.waves[0].status, "completed");
});
