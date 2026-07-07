/**
 * SP-516 — status/classification alignment after retry/resume (#166).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	alignTaskClassificationWithStatus,
	classifyTasks,
	reconcileBatch,
	syncPersistedClassifications,
} from "../../src/batch/reconcile.mjs";
import { classifyTaskDoneSemantics } from "../../src/batch/diagnosis-task-done.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import { parseBatchState } from "../../src/batch/batch-state-io.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {{ batchId?: string, taskId?: string, status?: string }} [options]
 */
function setupLaneDoneFixture(
	projectRoot,
	{ batchId = "20260704T233623", taskId = "SP-454", status = "failed" } = {},
) {
	const taskFolder = `spine-tasks/${taskId}-smoke`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	const laneTaskFolder = path.join(wt, taskFolder);
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = laneTaskBranch(batchId, 1);
	const hostTaskFolder = path.join(projectRoot, taskFolder);

	fs.mkdirSync(hostTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(hostTaskFolder, "PROMPT.md"), "# Task\n", "utf-8");

	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync(
		"git",
		["worktree", "add", "-b", taskBranch, wt, orchBranch],
		{ cwd: projectRoot, stdio: "ignore" },
	);
	fs.mkdirSync(laneTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(laneTaskFolder, "PROMPT.md"), "# Task\n", "utf-8");
	fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "Completed: 2026-07-04\n", "utf-8");

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status,
				taskFolder,
				startedAt: Date.now() - 60_000,
				endedAt: status === "failed" ? Date.now() - 30_000 : null,
				doneFileFound: false,
				exitReason: status === "failed" ? "worker_orphaned" : null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: taskBranch,
				taskIds: [taskId],
			},
		],
	});
	state.phase = status === "failed" ? "failed" : "running";
	if (status === "failed") {
		state.failedTasks = 1;
		updateSegmentForTask(state, taskId, "failed");
	} else {
		updateSegmentForTask(state, taskId, "running");
	}
	saveSpineBatchState(projectRoot, state);

	return { batchId, taskId, state, taskFolder, wt };
}

test("alignTaskClassificationWithStatus keeps failed + stale lane .DONE as terminal-failure", () => {
	const raw = classifyTaskDoneSemantics(
		{
			taskId: "SP-454",
			status: "failed",
			doneFileFound: false,
		},
		{
			tasksRoot: "/tmp/tasks",
			projectRoot: "/tmp",
			batchId: "batch",
			lanes: [],
		},
	);
	const withStaleDone = { ...raw, doneInLane: true, classification: "terminal-success" };
	const aligned = alignTaskClassificationWithStatus(withStaleDone);

	assert.equal(aligned.status, "failed");
	assert.equal(aligned.classification, "terminal-failure");
	assert.equal(aligned.doneInLane, true);
});

test("alignTaskClassificationWithStatus keeps pending after retry despite stale lane .DONE", () => {
	const raw = classifyTaskDoneSemantics(
		{
			taskId: "SP-441",
			status: "pending",
			doneFileFound: false,
		},
		{
			tasksRoot: "/tmp/tasks",
			projectRoot: "/tmp",
			batchId: "batch",
			lanes: [],
		},
	);
	const withStaleDone = { ...raw, doneInLane: true, classification: "terminal-success" };
	const aligned = alignTaskClassificationWithStatus(withStaleDone);

	assert.equal(aligned.status, "pending");
	assert.equal(aligned.classification, "pending");
});

test("alignTaskClassificationWithStatus preserves running + lane .DONE for drift reconcile", () => {
	const aligned = alignTaskClassificationWithStatus({
		taskId: "SP-440",
		status: "running",
		classification: "running",
		doneInLane: true,
		doneFileFound: false,
		doneOnMain: false,
	});

	assert.equal(aligned.classification, "terminal-success");
});

test("classifyTasks agrees status and classification for failed task with lane .DONE", async () => {
	const projectRoot = await initGitRepo("spine-status-class-failed-");
	try {
		const { taskId } = setupLaneDoneFixture(projectRoot, { status: "failed" });
		const loaded = loadSpineBatchState(projectRoot).raw;
		const batch = parseBatchState(loaded, "");
		const classified = classifyTasks(
			batch,
			path.join(projectRoot, "spine-tasks"),
			projectRoot,
		);

		assert.equal(classified[0].taskId, taskId);
		assert.equal(classified[0].status, "failed");
		assert.equal(classified[0].classification, "terminal-failure");
		assert.equal(classified[0].doneInLane, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("post-retry reconcile diagnose agrees status and classification", async () => {
	const projectRoot = await initGitRepo("spine-status-class-retry-");
	try {
		const { batchId, taskId } = setupLaneDoneFixture(projectRoot, { status: "failed" });

		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber: 1,
			classification: "worker_orphaned",
		});

		const retry = retryTask({ projectRoot, taskId });
		assert.equal(retry.ok, true, retry.output ?? retry.error);

		const classified = classifyTasks(
			parseBatchState(loadSpineBatchState(projectRoot).raw, ""),
			path.join(projectRoot, "spine-tasks"),
			projectRoot,
		);
		assert.equal(classified[0].status, "pending");
		assert.equal(classified[0].classification, "pending");
		assert.equal(classified[0].doneInLane, true);

		const reconcile = reconcileBatch({ projectRoot, verbose: true });
		const signalTask = reconcile.signals?.tasks?.find((task) => task.taskId === taskId);
		assert.ok(signalTask);
		assert.equal(signalTask.status, "pending");
		assert.equal(signalTask.classification, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPersistedClassifications clears stale failure classification after retry", async () => {
	const projectRoot = await initGitRepo("spine-status-class-sync-");
	try {
		const { taskId } = setupLaneDoneFixture(projectRoot, { status: "failed" });
		const state = loadSpineBatchState(projectRoot).raw;
		state.tasks[0].classification = "worker_orphaned";
		state.segments[0].classification = "worker_orphaned";
		saveSpineBatchState(projectRoot, state);

		const retry = retryTask({ projectRoot, taskId });
		assert.equal(retry.ok, true, retry.output ?? retry.error);

		const pendingState = loadSpineBatchState(projectRoot).raw;
		pendingState.tasks[0].classification = "terminal-success";
		saveSpineBatchState(projectRoot, pendingState);

		const synced = syncPersistedClassifications({ projectRoot, state: pendingState });
		assert.equal(synced.changed, true);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].classification, undefined);
		assert.equal(saved?.segments[0].classification, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
