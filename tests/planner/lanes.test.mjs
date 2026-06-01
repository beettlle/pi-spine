import assert from "node:assert/strict";
import test from "node:test";

import { assignLanesToWaves } from "../../src/planner/lanes.mjs";

test("assignLanesToWaves packs disjoint file scopes into same virtual lane", () => {
	const waves = [["A", "B", "C"]];
	const tasksById = {
		A: { fileScope: ["src/a/**"] },
		B: { fileScope: ["src/b/**"] },
		C: { fileScope: ["src/c/**"] },
	};

	const planned = assignLanesToWaves({ waves, tasksById, maxParallel: 2, queueExcess: true });
	assert.equal(planned.length, 1);
	assert.equal(planned[0].virtualLaneCount, 1);
	assert.equal(planned[0].ticks.length, 1);
	assert.deepEqual(planned[0].ticks[0].lanes[0], ["A", "B", "C"]);
});

test("assignLanesToWaves splits overlapping file scopes into different virtual lanes", () => {
	const waves = [["A", "B", "C"]];
	const tasksById = {
		A: { fileScope: ["src/shared/**"] },
		B: { fileScope: ["src/shared/utils/**"] },
		C: { fileScope: ["src/other/**"] },
	};

	const planned = assignLanesToWaves({ waves, tasksById, maxParallel: 10, queueExcess: true });
	assert.equal(planned[0].virtualLaneCount, 2);
	const aLane = planned[0].laneAssignments.A.virtualLane;
	const bLane = planned[0].laneAssignments.B.virtualLane;
	assert.notEqual(aLane, bLane);
});

test("assignLanesToWaves respects maxParallel by queueing excess virtual lanes into ticks", () => {
	const waves = [["A", "B", "C"]];
	const tasksById = {
		A: { fileScope: ["src/a/**"] },
		B: { fileScope: ["src/b/**"] },
		C: { fileScope: ["src/c/**"] },
	};

	// Force 3 virtual lanes by making all scopes overlap.
	const tasksByIdOverlap = {
		A: { fileScope: ["src/shared/**"] },
		B: { fileScope: ["src/shared/**"] },
		C: { fileScope: ["src/shared/**"] },
	};

	const planned = assignLanesToWaves({ waves, tasksById: tasksByIdOverlap, maxParallel: 2, queueExcess: true });
	assert.equal(planned[0].virtualLaneCount, 3);
	assert.equal(planned[0].ticks.length, 2);
	// Tick 0 has two lanes filled; tick 1 contains the last task.
	assert.equal(planned[0].ticks[0].lanes.flat().length, 2);
	assert.equal(planned[0].ticks[1].lanes.flat().length, 1);
});
