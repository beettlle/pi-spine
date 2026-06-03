import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { buildPlan } from "../../src/planner/index.mjs";

test("repo spine-tasks plan has wave0 TP-006||TP-007 and wave1 TP-008", () => {
	const tasksRoot = path.join(process.cwd(), "spine-tasks");
	const plan = buildPlan({
		scope: "TP-006,TP-007,TP-008",
		config: { lanes: { maxParallel: 2, queueExcess: true } },
		tasksRoot,
	});

	assert.deepEqual(plan.scope.taskIds, ["TP-006", "TP-007", "TP-008"]);
	assert.equal(plan.waves.length, 2);
	assert.deepEqual(plan.waves[0].taskIds, ["TP-006", "TP-007"]);
	assert.deepEqual(plan.waves[1].taskIds, ["TP-008"]);
});
