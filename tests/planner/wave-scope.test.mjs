import assert from "node:assert/strict";
import test from "node:test";
import {
	filterPlanToWave,
	parseBatchStartWaveFilter,
	resolveWaveTaskIds,
} from "../../src/planner/wave-scope.mjs";

const SAMPLE_PLAN = {
	waves: [
		{ index: 0, taskIds: ["TP-006", "TP-007"], virtualLaneCount: 2, ticks: [] },
		{ index: 1, taskIds: ["TP-008"], virtualLaneCount: 1, ticks: [] },
	],
	tasks: {
		"TP-006": { taskId: "TP-006", title: "Six", fileScope: ["src/a.mjs"], dependencies: [] },
		"TP-007": { taskId: "TP-007", title: "Seven", fileScope: ["src/b.mjs"], dependencies: [] },
		"TP-008": { taskId: "TP-008", title: "Eight", fileScope: ["src/c.mjs"], dependencies: ["TP-006"] },
	},
	scope: { mode: "explicit", taskIds: ["TP-006", "TP-007", "TP-008"] },
	metadata: { tasksSelected: 3 },
};

test("resolveWaveTaskIds returns wave task IDs", () => {
	const wave0 = resolveWaveTaskIds(SAMPLE_PLAN, 0);
	assert.equal(wave0.ok, true);
	assert.deepEqual(wave0.taskIds, ["TP-006", "TP-007"]);
	assert.equal(wave0.waveCount, 2);

	const wave1 = resolveWaveTaskIds(SAMPLE_PLAN, 1);
	assert.equal(wave1.ok, true);
	assert.deepEqual(wave1.taskIds, ["TP-008"]);
});

test("resolveWaveTaskIds rejects out-of-range and empty waves", () => {
	const outOfRange = resolveWaveTaskIds(SAMPLE_PLAN, 3);
	assert.equal(outOfRange.ok, false);
	assert.equal(outOfRange.error, "wave_out_of_range");
	assert.match(outOfRange.output, /out of range/);

	const emptyPlan = {
		waves: [{ index: 0, taskIds: [] }],
		tasks: {},
	};
	const emptyWave = resolveWaveTaskIds(emptyPlan, 0);
	assert.equal(emptyWave.ok, false);
	assert.equal(emptyWave.error, "wave_empty");
	assert.match(emptyWave.output, /has no tasks/);
});

test("filterPlanToWave narrows plan to one wave", () => {
	const filtered = filterPlanToWave(SAMPLE_PLAN, 1);
	assert.equal(filtered.ok, true);
	assert.deepEqual(filtered.taskIds, ["TP-008"]);
	assert.equal(filtered.plan.waves.length, 1);
	assert.deepEqual(filtered.plan.waves[0].taskIds, ["TP-008"]);
	assert.equal(filtered.plan.waves[0].index, 0);
	assert.deepEqual(filtered.plan.scope.taskIds, ["TP-008"]);
	assert.equal(filtered.plan.metadata.waveFilter, 1);
	assert.deepEqual(Object.keys(filtered.plan.tasks), ["TP-008"]);
});

test("parseBatchStartWaveFilter accepts --wave and --through-wave", () => {
	assert.deepEqual(parseBatchStartWaveFilter(["start", "pending", "--wave", "0"]), {
		waveFilter: 0,
	});
	assert.deepEqual(parseBatchStartWaveFilter(["start", "pending", "--through-wave", "2"]), {
		waveFilter: 2,
	});
	assert.deepEqual(parseBatchStartWaveFilter(["start", "pending"]), { waveFilter: null });
});

test("parseBatchStartWaveFilter rejects conflicting and invalid flags", () => {
	const conflict = parseBatchStartWaveFilter(["start", "pending", "--wave", "0", "--through-wave", "0"]);
	assert.equal(conflict.error, "conflicting_wave_flags");

	const missing = parseBatchStartWaveFilter(["start", "pending", "--wave"]);
	assert.equal(missing.error, "wave_flag_missing_value");

	const invalid = parseBatchStartWaveFilter(["start", "pending", "--wave", "nope"]);
	assert.equal(invalid.error, "wave_flag_invalid_value");
});
