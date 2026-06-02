import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { assignLanesToWaves } from "../../src/planner/lanes.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { formatPlanHuman } from "../../src/planner/format-plan.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

/** File scopes from TP-034, TP-038, TP-041 PROMPT.md (disjoint). */
const TP_034_038_041_SCOPES = {
	"TP-034": {
		fileScope: ["src/cli/settings-set.mjs", "bin/spine-settings.mjs", "tests/spine-settings-set.test.mjs"],
	},
	"TP-038": {
		fileScope: [
			"extensions/spine/worker-tools.ts",
			"src/worker-tools/request-gate.mjs",
			"templates/agents/worker.md",
			".spine/agents/worker.md",
			"bin/spine-worker-runner.mjs",
			"tests/worker-tools/worker-tools-registration.test.mjs",
		],
	},
	"TP-041": {
		fileScope: [
			"tests/batch/resume-multi-integration.test.mjs",
			"src/batch/status-diagnosis.mjs",
			"README.md",
			"taskplane-tasks/CONTEXT.md",
			"docs/compatibility/taskplane-gap-list.md",
		],
	},
};

test("TP-034/038/041 disjoint scopes get three virtual lanes in tick 0", () => {
	const waves = [["TP-034", "TP-038", "TP-041"]];
	const planned = assignLanesToWaves({
		waves,
		tasksById: TP_034_038_041_SCOPES,
		maxParallel: 4,
		queueExcess: true,
	});

	assert.equal(planned[0].virtualLaneCount, 3);
	assert.equal(planned[0].ticks.length, 1);
	const tick0 = planned[0].ticks[0];
	const nonEmptyLanes = tick0.lanes.filter((ids) => ids.length > 0);
	assert.equal(nonEmptyLanes.length, 3);
	assert.deepEqual(
		new Set(nonEmptyLanes.flat()),
		new Set(["TP-034", "TP-038", "TP-041"]),
	);
	for (const taskId of ["TP-034", "TP-038", "TP-041"]) {
		assert.equal(planned[0].laneAssignments[taskId].tick, 0);
	}
	const laneSlots = new Set(
		["TP-034", "TP-038", "TP-041"].map((id) => planned[0].laneAssignments[id].laneInTick),
	);
	assert.equal(laneSlots.size, 3);
});

test("overlapping file scopes share one virtual lane (serialized)", () => {
	const waves = [["A", "B", "C"]];
	const tasksById = {
		A: { fileScope: ["bin/spine.mjs"] },
		B: { fileScope: ["bin/spine.mjs"] },
		C: { fileScope: ["bin/**"] },
	};

	const planned = assignLanesToWaves({ waves, tasksById, maxParallel: 10, queueExcess: true });
	assert.equal(planned[0].virtualLaneCount, 1);
	assert.deepEqual(planned[0].ticks[0].lanes[0], ["A", "B", "C"]);
});

test("buildPlan for TP-034 TP-038 TP-041 lists three lanes in human output", () => {
	const configResult = loadSpineConfig(PROJECT_ROOT);
	assert.ok(configResult.config, configResult.error?.message);
	const tasksRoot = path.join(PROJECT_ROOT, configResult.config.paths.tasksRoot);
	const plan = buildPlan({
		scope: ["TP-034", "TP-038", "TP-041"],
		config: configResult.config,
		tasksRoot,
	});

	assert.equal(plan.waves[0].virtualLaneCount, 3);
	const human = formatPlanHuman(plan);
	assert.match(human, /Lane 1: TP-034/);
	assert.match(human, /Lane 2: TP-038/);
	assert.match(human, /Lane 3: TP-041/);
	assert.doesNotMatch(human, /Lane 1: TP-034, TP-038, TP-041/);
});

test("spine plan CLI shows three lanes for TP-034 TP-038 TP-041", () => {
	const output = execFileSync(
		process.execPath,
		["bin/spine.mjs", "plan", "TP-034", "TP-038", "TP-041"],
		{ cwd: PROJECT_ROOT, encoding: "utf-8" },
	);
	assert.match(output, /Lane 1: TP-034/);
	assert.match(output, /Lane 2: TP-038/);
	assert.match(output, /Lane 3: TP-041/);
	assert.doesNotMatch(output, /Lane 1: TP-034, TP-038, TP-041/);
});
