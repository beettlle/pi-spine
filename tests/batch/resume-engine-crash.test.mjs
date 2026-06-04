import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	failBatchFromEngineError,
	loadSpineBatchState,
	reconcileGhostRunningTasks,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_ID = "SP-097T";

function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId),
		"utf-8",
	);
	return folder;
}

function buildPausedSingleLaneState({ batchId, orchBranch, worktreePath }) {
	return createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "running",
				taskFolder: `spine-tasks/${TASK_ID}-smoke`,
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
				taskIds: [TASK_ID],
				lastHeartbeatAt: null,
				workerPid: 4242,
			},
		],
	});
}

test("failBatchFromEngineError writes batch.failed and clears enginePid", async () => {
	const projectRoot = await initGitRepo("spine-engine-fail-fn-");
	try {
		const batchId = "20260604T120000";
		const state = buildPausedSingleLaneState({
			batchId,
			orchBranch: `orch/spine-${batchId}`,
			worktreePath: laneWorktreePath(projectRoot, batchId, 1),
		});
		state.phase = "running";
		recordBatchEnginePid(state, 5150);
		saveSpineBatchState(projectRoot, state);

		failBatchFromEngineError({
			projectRoot,
			state,
			batchId,
			error: new Error("git status failure: not a git repository"),
			taskId: TASK_ID,
			laneNumber: 1,
		});

		const loaded = loadSpineBatchState(projectRoot);
		assert.equal(loaded.raw?.phase, "failed");
		assert.ok(loaded.raw?.endedAt);
		assert.match(String(loaded.raw?.lastError ?? ""), /git status failure/);
		assert.equal(loaded.raw?.resilience?.enginePid, undefined);

		const task = loaded.raw?.tasks?.find((entry) => entry.taskId === TASK_ID);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "engine_crashed");
		assert.equal(loaded.raw?.lanes?.[0]?.workerPid, undefined);

		const events = readJournalEvents(projectRoot, batchId);
		const failed = events.find((event) => event.type === "batch.failed");
		assert.ok(failed, "journal should contain batch.failed");
		assert.equal(failed.payload?.reason, "engine_error");
		assert.equal(failed.taskId, TASK_ID);
		assert.equal(failed.laneId, "lane-1");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileGhostRunningTasks marks running tasks failed without worker", () => {
	const state = {
		tasks: [
			{ taskId: "A", status: "running", exitReason: null },
			{ taskId: "B", status: "succeeded" },
		],
		segments: [
			{ segmentId: "A::default", taskId: "A", status: "running" },
			{ segmentId: "B::default", taskId: "B", status: "succeeded" },
		],
		lanes: [{ laneNumber: 1, workerPid: 999 }],
		succeededTasks: 1,
		failedTasks: 0,
		skippedTasks: 0,
	};

	reconcileGhostRunningTasks(state);
	assert.equal(state.tasks[0].status, "failed");
	assert.equal(state.segments[0].status, "failed");
	assert.equal(state.failedTasks, 1);
	assert.equal(state.lanes[0].workerPid, undefined);
});

test("resumeMultiTaskBatch fail-closed when post-commit gitPorcelain throws", async () => {
	const projectRoot = await initGitRepo("spine-resume-engine-crash-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevPorcelainThrow = process.env.SPINE_TEST_GIT_PORCELAIN_THROW;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_TEST_GIT_PORCELAIN_THROW = "after_commit";

	try {
		writeSmokeTask(projectRoot, TASK_ID);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [TASK_ID]: [] } }, null, 2),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add smoke task"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260604T130000";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const state = buildPausedSingleLaneState({
			batchId,
			orchBranch,
			worktreePath: lane.worktreePath,
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const { resumeMultiTaskBatch } = await import("../../src/batch/resume-multi.mjs");
		const result = await resumeMultiTaskBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "engine_crashed");

		const loaded = loadSpineBatchState(projectRoot);
		assert.notEqual(loaded.raw?.phase, "running");
		assert.equal(loaded.raw?.phase, "failed");
		assert.equal(loaded.raw?.resilience?.enginePid, undefined);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.failed"));

		const reconcile = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(reconcile.diagnosis, "running");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevPorcelainThrow === undefined) delete process.env.SPINE_TEST_GIT_PORCELAIN_THROW;
		else process.env.SPINE_TEST_GIT_PORCELAIN_THROW = prevPorcelainThrow;
		await destroyGitRepo(projectRoot);
	}
});
