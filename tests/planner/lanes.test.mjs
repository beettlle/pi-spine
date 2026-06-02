import assert from "node:assert/strict";
import test from "node:test";

import { assignLanesToWaves } from "../../src/planner/lanes.mjs";

test("assignLanesToWaves assigns disjoint file scopes to separate virtual lanes", () => {
	const waves = [["A", "B", "C"]];
	const tasksById = {
		A: { fileScope: ["src/a/**"] },
		B: { fileScope: ["src/b/**"] },
		C: { fileScope: ["src/c/**"] },
	};

	const planned = assignLanesToWaves({ waves, tasksById, maxParallel: 2, queueExcess: true });
	assert.equal(planned.length, 1);
	assert.equal(planned[0].virtualLaneCount, 3);
	assert.equal(planned[0].ticks.length, 2);
	assert.equal(planned[0].ticks[0].lanes.flat().length, 2);
	assert.equal(planned[0].ticks[1].lanes.flat().length, 1);
});

test("assignLanesToWaves packs overlapping file scopes into same virtual lane", () => {
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
	assert.equal(aLane, bLane);
	assert.notEqual(planned[0].laneAssignments.C.virtualLane, aLane);
});

test("assignLanesToWaves respects maxParallel by queueing excess virtual lanes into ticks", () => {
	const waves = [["A", "B", "C"]];
	const tasksById = {
		A: { fileScope: ["src/a/**"] },
		B: { fileScope: ["src/b/**"] },
		C: { fileScope: ["src/c/**"] },
	};

	const planned = assignLanesToWaves({ waves, tasksById, maxParallel: 2, queueExcess: true });
	assert.equal(planned[0].virtualLaneCount, 3);
	assert.equal(planned[0].ticks.length, 2);
	assert.equal(planned[0].ticks[0].lanes.flat().length, 2);
	assert.equal(planned[0].ticks[1].lanes.flat().length, 1);
});
