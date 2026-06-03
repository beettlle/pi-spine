/**
 * PRD §20.2 integration fixture: tasks A, B (deps A), C independent.
 * Waves: {A,C} then {B}; two-lane stub batch; mixed-outcome + retry/resume smoke.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_A = "TP-901";
const TASK_B = "TP-902";
const TASK_C = "TP-903";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {string} fileScopePath
 * @param {string[]} deps
 */
function writeAbcTask(projectRoot, taskId, slug, fileScopePath, deps = []) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });
	const depLines = deps.length ? deps.map((d) => `- **${d}**`).join("\n") : "- **None**";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — ${slug}

## Mission
PRD §20.2 ABC integration fixture (${slug}).

## Dependencies
${depLines}

## File Scope
- \`${fileScopePath}\`

## Steps
### Step 0
- [ ] one
`,
		"utf-8",
	);
}

function writeAbcDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_A]: [],
					[TASK_B]: [TASK_A],
					[TASK_C]: [],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

function setMaxParallel(projectRoot, maxParallel) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.lanes = { ...config.lanes, maxParallel, queueExcess: true };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function waveTaskIds(plan) {
	return (plan.waves ?? []).map((wave) => wave.taskIds ?? []);
}

test("PRD §20.2 planner yields wave0 {A,C} and wave1 {B}", async () => {
	const projectRoot = await initGitRepo("spine-abc-plan-");
	try {
		writeAbcTask(projectRoot, TASK_A, "task-a", "src/a.txt");
		writeAbcTask(projectRoot, TASK_B, "task-b", "src/b.txt", [TASK_A]);
		writeAbcTask(projectRoot, TASK_C, "task-c", "src/c.txt");
		writeAbcDependencies(projectRoot);
		execCommit(projectRoot, "add abc tasks");

		const config = loadSpineConfig(projectRoot);
		const tasksRoot = resolveTasksRoot(projectRoot, config);
		const plan = buildPlan({
			scope: `${TASK_A} ${TASK_B} ${TASK_C}`,
			config,
			tasksRoot,
		});

		const ids = waveTaskIds(plan);
		assert.deepEqual(ids[0].sort(), [TASK_A, TASK_C].sort());
		assert.deepEqual(ids[1], [TASK_B]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("PRD §20.2 two-lane stub batch completes ABC waves", async () => {
	const projectRoot = await initGitRepo("spine-abc-batch-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		setMaxParallel(projectRoot, 2);
		writeAbcTask(projectRoot, TASK_A, "task-a", "src/a.txt");
		writeAbcTask(projectRoot, TASK_B, "task-b", "src/b.txt", [TASK_A]);
		writeAbcTask(projectRoot, TASK_C, "task-c", "src/c.txt");
		writeAbcDependencies(projectRoot);
		execCommit(projectRoot, "add abc tasks");

		const result = await startBatch({
			projectRoot,
			scope: `${TASK_A} ${TASK_B} ${TASK_C}`,
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const state = loadSpineBatchState(projectRoot);
		assert.equal(state.raw?.phase, "completed");
		assert.equal(state.raw?.succeededTasks, 3);
		assert.deepEqual(state.raw?.wavePlan?.[0]?.sort(), [TASK_A, TASK_C].sort());
		assert.deepEqual(state.raw?.wavePlan?.[1], [TASK_B]);
		assert.equal(state.raw?.lanes?.length, 2);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("PRD §20.2 mixed-outcome blocks merge; retry resets wave B for resume", async () => {
	const projectRoot = await initGitRepo("spine-abc-retry-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevFail = process.env.SPINE_WORKER_STUB_FAIL_TASKS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_FAIL_TASKS = TASK_B;
	try {
		setMaxParallel(projectRoot, 2);
		writeAbcTask(projectRoot, TASK_A, "task-a", "src/a.txt");
		writeAbcTask(projectRoot, TASK_B, "task-b", "src/b.txt", [TASK_A]);
		writeAbcTask(projectRoot, TASK_C, "task-c", "src/c.txt");
		writeAbcDependencies(projectRoot);
		execCommit(projectRoot, "add abc tasks");

		const first = await startBatch({
			projectRoot,
			scope: `${TASK_A} ${TASK_B} ${TASK_C}`,
			skipPreflight: true,
		});
		assert.equal(first.ok, false);
		assert.equal(first.error, "mixed_outcome_merge_blocked");
		assert.deepEqual(first.failedTaskIds, [TASK_B]);

		const mid = loadSpineBatchState(projectRoot).raw;
		assert.equal(mid?.phase, "failed");
		assert.equal(mid?.succeededTasks, 2);
		assert.equal(mid?.wavePlan?.[1]?.[0], TASK_B);

		const retry = retryTask({ projectRoot, taskId: TASK_B });
		assert.equal(retry.ok, true, retry.output ?? retry.error);
		assert.equal(retry.pendingSegments, 1);
		assert.match(retry.output ?? "", /resume --force/);

		const afterRetry = loadSpineBatchState(projectRoot).raw;
		const taskB = afterRetry?.tasks?.find((task) => task.taskId === TASK_B);
		assert.equal(taskB?.status, "pending");
		assert.equal(
			afterRetry?.segments?.find((segment) => segment.taskId === TASK_B)?.status,
			"pending",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevFail === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_TASKS;
		else process.env.SPINE_WORKER_STUB_FAIL_TASKS = prevFail;
		await destroyGitRepo(projectRoot);
	}
});
