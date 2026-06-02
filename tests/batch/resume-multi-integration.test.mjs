/**
 * End-to-end multi-task resume: start → pause/interrupt → resume (batch 20260602T181027 regression).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_A = "TP-971";
const TASK_B = "TP-972";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} fileScopePath
 */
function writeSmokeTask(projectRoot, taskId, fileScopePath) {
	const folder = path.join(projectRoot, "taskplane-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Smoke

## Mission
Multi-task resume integration fixture.

## Dependencies
- **None**

## File Scope
- \`${fileScopePath}\`

## Steps
### Step 0
- [ ] one
`,
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [TASK_A]: [], [TASK_B]: [] } }, null, 2),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function setMaxParallel(projectRoot, maxParallel) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.lanes = { ...config.lanes, maxParallel, queueExcess: true };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

test("multi-task batch start → pause → resume completes both tasks", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-int-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		setMaxParallel(projectRoot, 2);
		writeSmokeTask(projectRoot, TASK_A, "src/a-resume-multi.txt");
		writeSmokeTask(projectRoot, TASK_B, "src/b-resume-multi.txt");
		writeDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add multi resume tasks"], { cwd: projectRoot, stdio: "ignore" });

		const startResult = await startBatch({
			projectRoot,
			scope: `${TASK_A} ${TASK_B}`,
			skipPreflight: true,
		});
		assert.equal(startResult.ok, true, startResult.output ?? startResult.error);

		for (const taskId of [TASK_A, TASK_B]) {
			const donePath = path.join(projectRoot, "taskplane-tasks", `${taskId}-smoke`, ".DONE");
			if (fs.existsSync(donePath)) fs.unlinkSync(donePath);
		}

		const state = loadSpineBatchState(projectRoot).raw;
		assert.ok(state);

		state.phase = "paused";
		state.succeededTasks = 0;
		state.endedAt = null;
		for (const task of state.tasks ?? []) {
			task.status = "running";
			task.doneFileFound = false;
			task.endedAt = null;
		}
		for (const segment of state.segments ?? []) {
			segment.status = "pending";
		}
		saveSpineBatchState(projectRoot, state);

		const resumeResult = await resumeBatch({ projectRoot });
		assert.equal(resumeResult.ok, true, resumeResult.output ?? resumeResult.error);
		assert.notEqual(resumeResult.error, "single_lane_required");

		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed");
		assert.equal(final?.succeededTasks, 2);

		const events = readJournalEvents(projectRoot, state.batchId);
		assert.ok(events.some((event) => event.type === "batch.resumed"));
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === TASK_A));
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === TASK_B));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("paused multi-task batch diagnose suggests multi-task resume", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-dx-");
	try {
		const batchId = "20260602T181027";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[TASK_A, TASK_B]],
			tasks: [
				{
					taskId: TASK_A,
					laneNumber: 1,
					status: "running",
					taskFolder: `taskplane-tasks/${TASK_A}-smoke`,
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
				{
					taskId: TASK_B,
					laneNumber: 2,
					status: "running",
					taskFolder: `taskplane-tasks/${TASK_B}-smoke`,
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: lane1.worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [TASK_A],
					lastHeartbeatAt: null,
				},
				{
					laneNumber: 2,
					laneId: "lane-2",
					worktreePath: lane2.worktreePath,
					branch: laneTaskBranch(batchId, 2),
					taskIds: [TASK_B],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "paused");
		assert.equal(result.suggestedCommand, "spine batch resume");
		assert.match(result.headline, /multi-task/i);
		assert.match(result.headline, /spine batch resume/i);
		assert.match(result.headline, /2 tasks pending/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("multi-task startBatch completes two-lane stub batch (start path)", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-start-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		setMaxParallel(projectRoot, 2);
		writeSmokeTask(projectRoot, TASK_A, "src/a-start.txt");
		writeSmokeTask(projectRoot, TASK_B, "src/b-start.txt");
		writeDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = await startBatch({
			projectRoot,
			scope: `${TASK_A} ${TASK_B}`,
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed");
		assert.equal(final?.succeededTasks, 2);
		assert.equal(final?.lanes?.length, 2);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
