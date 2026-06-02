import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateMultiTaskResume } from "../../src/batch/resume-multi.mjs";
import { validateResumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function buildTwoTaskPausedState({ projectRoot, batchId, orchBranch, worktreePaths }) {
	const taskA = "TP-031";
	const taskB = "TP-032";
	return createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskA, taskB]],
		tasks: [
			{
				taskId: taskA,
				laneNumber: 1,
				status: "running",
				taskFolder: `taskplane-tasks/${taskA}-smoke`,
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
			{
				taskId: taskB,
				laneNumber: 2,
				status: "running",
				taskFolder: `taskplane-tasks/${taskB}-smoke`,
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
				worktreePath: worktreePaths[0],
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskA],
				lastHeartbeatAt: null,
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: worktreePaths[1],
				branch: laneTaskBranch(batchId, 2),
				taskIds: [taskB],
				lastHeartbeatAt: null,
			},
		],
	});
}

test("validateMultiTaskResume accepts paused 2-task 2-lane batch", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-ok-");
	try {
		const batchId = "20260602T181027";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = buildTwoTaskPausedState({
			projectRoot,
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, lane2.worktreePath],
		});
		state.phase = "paused";
		state.currentWaveIndex = 0;
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.batchId, batchId);
		assert.equal(result.pendingTasks.length, 2);
		assert.equal(result.lanes.length, 2);
		assert.equal(result.resumableWave, 0);
		assert.deepEqual(
			result.pendingTasks.map((task) => task.taskId).sort(),
			["TP-031", "TP-032"],
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume rejects batch with zero tasks", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-notasks-");
	try {
		const batchId = "20260602T181028";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[]],
			tasks: [],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: [],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "no_tasks_or_lanes");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume rejects missing worktree per lane", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-wtmiss-");
	try {
		const batchId = "20260602T181029";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const missingLane2Path = laneWorktreePath(projectRoot, batchId, 2);

		const state = buildTwoTaskPausedState({
			projectRoot,
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, missingLane2Path],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "worktree_missing");
		assert.equal(result.laneNumber, 2);
		assert.match(result.output ?? "", /lane-2/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateResumeBatch delegates to multi validator for single-task batch", async () => {
	const projectRoot = await initGitRepo("spine-resume-delegate-");
	try {
		const batchId = "20260602T181030";
		const taskId = "TP-999";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: path.join("taskplane-tasks", `${taskId}-smoke`),
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
					worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateResumeBatch({ projectRoot });
		assert.equal(result.ok, true);
		assert.equal(result.taskId, taskId);
		assert.equal(result.pendingTasks.length, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
