import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { assignLanesToWaves } from "../../src/planner/lanes.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { formatPlanHuman } from "../../src/planner/format-plan.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const PLAN_CONFIG = { lanes: { maxParallel: 4, queueExcess: true } };
const SPINE_BIN = path.resolve(import.meta.dirname, "../../bin/spine.mjs");

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
			"spine-tasks/CONTEXT.md",
			"docs/compatibility/taskplane-gap-list.md",
		],
	},
};

async function createDisjointScopeFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-lanes-parallel-"));
	const tasksRoot = path.join(root, "spine-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });
	fs.mkdirSync(path.join(root, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(root, ".spine", "spine-config.json"),
		JSON.stringify(
			{
				configVersion: 1,
				project: { name: "lanes-parallel" },
				paths: { tasksRoot: "spine-tasks" },
				baseBranch: "main",
				testing: { commands: ["npm test"] },
				agents: { worker: { model: "inherit", thinking: "medium" } },
				lanes: { maxParallel: 4, queueExcess: true },
				gates: { requireBeforeIntegrate: true },
			},
			null,
			2,
		),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(tasksRoot, "dependencies.json"),
		JSON.stringify({ version: 1, tasks: {} }, null, 2),
		"utf-8",
	);

	for (const taskId of ["TP-034", "TP-038", "TP-041"]) {
		writeDisjointScopeTask(tasksRoot, taskId, TP_034_038_041_SCOPES[taskId].fileScope);
	}

	return { root, tasksRoot };
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {string[]} fileScopePaths
 */
function writeDisjointScopeTask(tasksRoot, taskId, fileScopePaths) {
	const folder = path.join(tasksRoot, `${taskId}-lanes-fixture`);
	fs.mkdirSync(folder, { recursive: true });
	const body = minimalValidPromptMarkdown(taskId, {
		title: `${taskId} lanes fixture`,
		fileScope: fileScopePaths[0],
	});
	const lines = body.split("\n");
	const fileScopeIdx = lines.findIndex((line) => line === "## File Scope");
	const stepsIdx = lines.findIndex((line) => line === "## Steps");
	const prompt = [
		...lines.slice(0, fileScopeIdx + 1),
		...fileScopePaths.map((scopePath) => `- \`${scopePath}\``),
		...lines.slice(stepsIdx),
	].join("\n");
	fs.writeFileSync(path.join(folder, "PROMPT.md"), prompt, "utf-8");
}

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

test("buildPlan for TP-034 TP-038 TP-041 lists three lanes in human output", async () => {
	const { root, tasksRoot } = await createDisjointScopeFixture();
	try {
		const plan = buildPlan({
			scope: ["TP-034", "TP-038", "TP-041"],
			config: PLAN_CONFIG,
			tasksRoot,
		});

		assert.equal(plan.waves[0].virtualLaneCount, 3);
		const human = formatPlanHuman(plan);
		assert.match(human, /Lane 1: TP-034/);
		assert.match(human, /Lane 2: TP-038/);
		assert.match(human, /Lane 3: TP-041/);
		assert.doesNotMatch(human, /Lane 1: TP-034, TP-038, TP-041/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spine plan CLI shows three lanes for TP-034 TP-038 TP-041", async () => {
	const { root } = await createDisjointScopeFixture();
	try {
		const output = execFileSync(
			process.execPath,
			[SPINE_BIN, "plan", "TP-034", "TP-038", "TP-041"],
			{ cwd: root, encoding: "utf-8" },
		);
		assert.match(output, /Lane 1: TP-034/);
		assert.match(output, /Lane 2: TP-038/);
		assert.match(output, /Lane 3: TP-041/);
		assert.doesNotMatch(output, /Lane 1: TP-034, TP-038, TP-041/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
