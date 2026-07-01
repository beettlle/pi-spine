/**
 * SP-387 — sequence runner core loop (GitHub #54 Tier 2 SP-C).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import {
	buildSequenceDryRunPlan,
	buildSequencePlan,
	buildSequenceWaveCommands,
	isSequenceBatchFailure,
	isSequenceBatchSettled,
	isSequenceBatchWaiting,
	resolveSequenceWaves,
	resolveWaveTaskIds,
	runSequence,
} from "../../src/batch/sequence.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_W0 = "SP-501";
const TASK_W1 = "SP-502";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {string} fileScopePath
 * @param {string[]} deps
 */
function writeSequenceTask(projectRoot, taskId, slug, fileScopePath, deps = []) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });
	const depLines = deps.length ? deps.map((dep) => `- **${dep}**`).join("\n") : "- **None**";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: slug,
			fileScope: fileScopePath,
			mission: `Sequence fixture task ${slug}.`,
		}).replace("## Dependencies\n- **None**", `## Dependencies\n${depLines}`),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeSequenceDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_W0]: [],
					[TASK_W1]: [TASK_W0],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

test("resolveWaveTaskIds and resolveSequenceWaves honor planner waves", () => {
	const plan = {
		waves: [
			{ index: 0, taskIds: [TASK_W0] },
			{ index: 1, taskIds: [TASK_W1] },
		],
	};

	assert.deepEqual(resolveWaveTaskIds(plan, 0), {
		ok: true,
		waveIndex: 0,
		taskIds: [TASK_W0],
		waveCount: 2,
	});

	const outOfRange = resolveWaveTaskIds(plan, 3);
	assert.equal(outOfRange.ok, false);
	assert.equal(outOfRange.error, "wave_out_of_range");

	const sequence = resolveSequenceWaves(plan, { fromWave: 0, throughWave: 1 });
	assert.equal(sequence.ok, true);
	assert.deepEqual(sequence.waves, [
		{ waveIndex: 0, taskIds: [TASK_W0] },
		{ waveIndex: 1, taskIds: [TASK_W1] },
	]);
});

test("diagnosis helpers classify settled, waiting, and failure states", () => {
	assert.equal(isSequenceBatchSettled("needs_integrate"), true);
	assert.equal(isSequenceBatchSettled("running"), false);
	assert.equal(isSequenceBatchWaiting("running"), true);
	assert.equal(isSequenceBatchFailure("failed"), true);
});

test("dry-run prints operator-equivalent land loop commands per wave", () => {
	const plan = {
		waves: [
			{ index: 0, taskIds: [TASK_W0] },
			{ index: 1, taskIds: [TASK_W1] },
		],
	};

	const dry = buildSequenceDryRunPlan({ plan, autoApproveGate: true });
	assert.equal(dry.ok, true);
	assert.equal(dry.commands.length, 12);
	assert.deepEqual(
		buildSequenceWaveCommands({
			waveIndex: 0,
			taskIds: [TASK_W0],
			autoApproveGate: true,
		}),
		[
			"# Wave 0",
			`spine batch start ${TASK_W0}`,
			"spine status --diagnose  # wait for terminal batch phase",
			"spine gate approve",
			"spine integrate",
			"spine batch complete",
		],
	);
	assert.match(dry.output, new RegExp(`spine batch start ${TASK_W0}`));
	assert.match(dry.output, new RegExp(`spine batch start ${TASK_W1}`));
	assert.match(dry.output, /spine gate approve/);
	assert.match(dry.output, /spine integrate/);
	assert.match(dry.output, /spine batch complete/);
});

test("2-wave stub sequence completes with auto-approve land loop", async () => {
	const projectRoot = await initGitRepo("spine-sequence-2wave-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0", "src/seq-w0.txt");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1", "src/seq-w1.txt", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence tasks"], { cwd: projectRoot, stdio: "ignore" });

		const config = loadSpineConfig(projectRoot);
		const tasksRoot = resolveTasksRoot(projectRoot, config);
		const plan = buildPlan({
			scope: "pending",
			config,
			tasksRoot,
		});
		assert.deepEqual(
			plan.waves.map((wave) => wave.taskIds),
			[[TASK_W0], [TASK_W1]],
		);

		const result = await runSequence({
			projectRoot,
			plan,
			attached: true,
			autoApproveGate: true,
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.completedWaves?.length, 2);
		assert.equal(result.completedWaves?.[0]?.waveIndex, 0);
		assert.equal(result.completedWaves?.[1]?.waveIndex, 1);
		assert.equal(loadSpineBatchState(projectRoot).raw, null);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("buildSequencePlan resolves pending scope for dry-run integration", async () => {
	const projectRoot = await initGitRepo("spine-sequence-plan-");
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0", "src/seq-w0.txt");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1", "src/seq-w1.txt", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence tasks"], { cwd: projectRoot, stdio: "ignore" });

		const built = buildSequencePlan(projectRoot, "pending");
		assert.equal(built.ok, true);
		const dry = await runSequence({
			projectRoot,
			plan: built.plan,
			dryRun: true,
			autoApproveGate: false,
		});
		assert.equal(dry.ok, true);
		assert.equal(dry.dryRun, true);
		assert.equal(dry.commands?.length, 12);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
