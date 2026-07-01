import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseBatchArgs } from "../../bin/spine-batch.mjs";
import { buildAttachedBatchStartArgv } from "../../src/batch/detached-start.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_W0A = "TP-601";
const TASK_W0B = "TP-602";
const TASK_W1 = "TP-603";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {string} fileScopePath
 * @param {string[]} deps
 */
function writeWaveTask(projectRoot, taskId, slug, fileScopePath, deps = []) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });
	const depLines = deps.length ? deps.map((dep) => `- **${dep}**`).join("\n") : "- **None**";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: slug,
			fileScope: fileScopePath,
			mission: `Wave filter fixture ${slug}.`,
		}).replace("## Dependencies\n- **None**", `## Dependencies\n${depLines}`),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeWaveDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_W0A]: [],
					[TASK_W0B]: [],
					[TASK_W1]: [TASK_W0A],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeWaveFixture(projectRoot) {
	writeWaveTask(projectRoot, TASK_W0A, "wave0-a", "src/w0a.mjs");
	writeWaveTask(projectRoot, TASK_W0B, "wave0-b", "src/w0b.mjs");
	writeWaveTask(projectRoot, TASK_W1, "wave1", "src/w1.mjs", [TASK_W0A]);
	writeWaveDependencies(projectRoot);
}

test("parseBatchArgs maps --wave on start to waveFilter", () => {
	const parsed = parseBatchArgs(["start", "pending", "--wave", "1", "--dry-run"]);
	assert.equal(parsed.subcommand, "start");
	assert.equal(parsed.waveFilter, 1);
	assert.equal(parsed.scope, "pending");
	assert.equal(parsed.dryRun, true);
});

test("parseBatchArgs strips --wave value from scope for wave 0", () => {
	const parsed = parseBatchArgs(["start", "pending", "--wave", "0", "--dry-run"]);
	assert.equal(parsed.subcommand, "start");
	assert.equal(parsed.waveFilter, 0);
	assert.equal(parsed.scope, "pending");
	assert.equal(parsed.dryRun, true);
});

test("buildAttachedBatchStartArgv forwards waveFilter to detached engine", () => {
	const argv = buildAttachedBatchStartArgv({
		scope: "pending",
		skipPreflight: true,
		waveFilter: 0,
	});
	assert.deepEqual(argv, ["batch", "start", "pending", "--attached", "--skip-preflight", "--wave", "0"]);
});

test("startBatch dry-run with pending scope and --wave 0 selects planner wave 0", async () => {
	const projectRoot = await initGitRepo("spine-batch-pending-wave0-");
	try {
		writeWaveFixture(projectRoot);
		execCommit(projectRoot, "pending wave0 fixture");

		const result = await startBatch({
			projectRoot,
			scope: "pending",
			dryRun: true,
			skipPreflight: true,
			waveFilter: 0,
		});
		assert.equal(result.ok, true);
		assert.deepEqual(result.taskIds.sort(), [TASK_W0A, TASK_W0B].sort());
		assert.match(result.output, /planner wave 0/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch dry-run with --wave selects planner wave task IDs", async () => {
	const projectRoot = await initGitRepo("spine-batch-wave-filter-");
	try {
		writeWaveFixture(projectRoot);
		execCommit(projectRoot, "wave fixture");

		const wave0 = await startBatch({
			projectRoot,
			scope: `${TASK_W0A} ${TASK_W0B} ${TASK_W1}`,
			dryRun: true,
			skipPreflight: true,
			waveFilter: 0,
		});
		assert.equal(wave0.ok, true);
		assert.deepEqual(wave0.taskIds.sort(), [TASK_W0A, TASK_W0B].sort());
		assert.equal(wave0.plan.waves.length, 1);
		assert.match(wave0.output, /planner wave 0/);

		const wave1 = await startBatch({
			projectRoot,
			scope: `${TASK_W0A} ${TASK_W0B} ${TASK_W1}`,
			dryRun: true,
			skipPreflight: true,
			waveFilter: 1,
		});
		assert.equal(wave1.ok, true);
		assert.deepEqual(wave1.taskIds, [TASK_W1]);

		const invalid = await startBatch({
			projectRoot,
			scope: `${TASK_W0A} ${TASK_W0B} ${TASK_W1}`,
			dryRun: true,
			skipPreflight: true,
			waveFilter: 9,
		});
		assert.equal(invalid.ok, false);
		assert.equal(invalid.error, "wave_out_of_range");
		assert.match(invalid.output, /out of range/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("wave-filtered dry-run matches explicit wave task scope dry-run", async () => {
	const projectRoot = await initGitRepo("spine-batch-wave-parity-");
	try {
		writeWaveFixture(projectRoot);
		execCommit(projectRoot, "wave parity fixture");

		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const config = { lanes: { maxParallel: 2, queueExcess: true } };
		const plan = buildPlan({
			scope: `${TASK_W0A} ${TASK_W0B} ${TASK_W1}`,
			config,
			tasksRoot,
		});
		const wave0Ids = plan.waves[0].taskIds;

		const filtered = await startBatch({
			projectRoot,
			scope: `${TASK_W0A} ${TASK_W0B} ${TASK_W1}`,
			dryRun: true,
			skipPreflight: true,
			waveFilter: 0,
		});
		const explicit = await startBatch({
			projectRoot,
			scope: wave0Ids.join(" "),
			dryRun: true,
			skipPreflight: true,
		});

		assert.equal(filtered.ok, true);
		assert.equal(explicit.ok, true);
		assert.deepEqual(filtered.taskIds.sort(), explicit.taskIds.sort());
		assert.deepEqual(filtered.plan.waves[0].taskIds.sort(), explicit.plan.waves[0].taskIds.sort());
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * @param {string} projectRoot
 * @param {string} message
 */
function execCommit(projectRoot, message) {
	execFileSync("git", ["-C", projectRoot, "add", "-A"], { stdio: "pipe" });
	execFileSync(
		"git",
		["-C", projectRoot, "-c", "user.email=test@test.com", "-c", "user.name=Test", "commit", "-m", message],
		{ stdio: "pipe" },
	);
}
