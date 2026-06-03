import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), `# Task: ${taskId}\n`, "utf-8");
	return folder;
}

function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

function buildTwoTaskPausedState({ batchId, orchBranch, worktreePaths }) {
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
				taskFolder: `spine-tasks/${taskA}-smoke`,
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
			{
				taskId: taskB,
				laneNumber: 2,
				status: "running",
				taskFolder: `spine-tasks/${taskB}-smoke`,
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

test("resumeBatch continues paused 2-task 2-lane batch with stub workers", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-engine-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-031");
		writeSmokeTask(projectRoot, "TP-032");
		writeDependencies(projectRoot, { "TP-031": [], "TP-032": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add smoke tasks"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260602T181027";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = buildTwoTaskPausedState({
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, lane2.worktreePath],
		});
		state.phase = "paused";
		state.currentWaveIndex = 0;
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.notEqual(result.error, "single_lane_required");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.succeededTasks, 2);

		const events = readJournalEvents(projectRoot, batchId);
		const resumed = events.find((event) => event.type === "batch.resumed");
		assert.ok(resumed, "journal should contain batch.resumed");
		assert.ok(resumed.payload?.pendingSegments != null);
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === "TP-031"));
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === "TP-032"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch multi path requires existing lane worktrees", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-wt-");
	try {
		const batchId = "20260602T181028";
		const orchBranch = `orch/spine-${batchId}`;
		const state = buildTwoTaskPausedState({
			batchId,
			orchBranch,
			worktreePaths: [
				laneWorktreePath(projectRoot, batchId, 1),
				laneWorktreePath(projectRoot, batchId, 2),
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "worktree_missing");
		assert.notEqual(result.error, "single_lane_required");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
