/**
 * SP-657 — post-DONE orphan auto-heal before merge_blocked (#205).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { recordMergeBlocked } from "../../src/batch/lifecycle.mjs";
import { reconcileOrphanRunningState } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const BATCH_ID = "20260713T171709";
const TASK_DONE = "SP-649";
const TASK_OTHER = "SP-650";

/**
 * @param {string} projectRoot
 * @param {string} laneWorktree
 * @param {string} taskId
 */
function writeCommittedDoneInLane(projectRoot, laneWorktree, taskId) {
	const taskFolderRel = `spine-tasks/${taskId}-post-done`;
	const hostFolder = path.join(projectRoot, taskFolderRel);
	fs.mkdirSync(hostFolder, { recursive: true });
	fs.writeFileSync(path.join(hostFolder, "PROMPT.md"), `# ${taskId}\n`, "utf-8");

	const laneFolder = path.join(laneWorktree, taskFolderRel);
	fs.mkdirSync(laneFolder, { recursive: true });
	fs.writeFileSync(path.join(laneFolder, ".DONE"), "done\n", "utf-8");
	execFileSync("git", ["add", `${taskFolderRel}/.DONE`], { cwd: laneWorktree, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", `worker: ${taskId} .DONE`], {
		cwd: laneWorktree,
		stdio: "ignore",
	});
	return taskFolderRel;
}

/**
 * Post-DONE + dead worker/engine shape (post-mortem F2 / batch 20260713T171709).
 *
 * @param {string} projectRoot
 * @param {object} [options]
 */
function seedPostDoneOrphan(projectRoot, options = {}) {
	const withCommittedDone = options.withCommittedDone !== false;
	const orchBranch = `orch/spine-${BATCH_ID}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const lane1 = provisionLaneWorktree({
		projectRoot,
		batchId: BATCH_ID,
		laneNumber: 1,
		orchBranch,
	});

	const taskFolderRel = withCommittedDone
		? writeCommittedDoneInLane(projectRoot, lane1.worktreePath, TASK_DONE)
		: `spine-tasks/${TASK_DONE}-post-done`;

	if (!withCommittedDone) {
		const laneFolder = path.join(lane1.worktreePath, taskFolderRel);
		fs.mkdirSync(laneFolder, { recursive: true });
		fs.writeFileSync(path.join(laneFolder, ".DONE"), "done\n", "utf-8");
	}

	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[TASK_DONE]],
		tasks: [
			{
				taskId: TASK_DONE,
				laneNumber: 1,
				status: "running",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 4 * 60 * 60_000,
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
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_DONE],
				lastHeartbeatAt: Date.now() - 60_000,
				workerPid: DEAD_PID,
			},
		],
	});
	state.phase = "running";
	recordBatchEnginePid(state, DEAD_PID);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
		taskId: TASK_DONE,
		laneNumber: 1,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "lane.heartbeat", {
		laneNumber: 1,
		taskId: TASK_DONE,
	});

	return { taskFolderRel, lane1 };
}

test("today without heal: post-DONE orphan fails into merge_blocked failed set", async () => {
	const projectRoot = await initGitRepo("spine-657-pre-heal-");
	try {
		// Filesystem-only .DONE (not committed) must still fail — fail-closed.
		seedPostDoneOrphan(projectRoot, { withCommittedDone: false });

		const before = loadSpineBatchState(projectRoot).raw;
		const result = reconcileOrphanRunningState({ projectRoot, state: before });
		assert.equal(result.reconciled, true);
		assert.deepEqual(result.healedTaskIds ?? [], []);

		const after = loadSpineBatchState(projectRoot).raw;
		const task = after?.tasks?.find((entry) => entry.taskId === TASK_DONE);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "worker_orphaned");
		assert.equal(after?.phase, "failed");

		recordMergeBlocked({
			projectRoot,
			state: after,
			batchId: BATCH_ID,
			error: "mixed_outcome",
			failedTaskIds: (after.tasks ?? [])
				.filter((entry) => entry.status === "failed")
				.map((entry) => entry.taskId),
		});
		const blocked = loadSpineBatchState(projectRoot).raw;
		assert.equal(blocked?.phase, "merge_blocked");
		const events = readJournalEvents(projectRoot, BATCH_ID);
		const mergeBlocked = events.find((event) => event.type === "batch.merge_blocked");
		assert.ok(mergeBlocked);
		assert.deepEqual(mergeBlocked.payload?.failedTaskIds ?? mergeBlocked.failedTaskIds, [
			TASK_DONE,
		]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("post-DONE orphan with committed .DONE heals via skippedDoneOnDisk (no merge_blocked failed)", async () => {
	const projectRoot = await initGitRepo("spine-657-heal-");
	try {
		seedPostDoneOrphan(projectRoot, { withCommittedDone: true });

		const before = loadSpineBatchState(projectRoot).raw;
		const result = reconcileOrphanRunningState({ projectRoot, state: before });
		assert.equal(result.reconciled, true);
		assert.deepEqual(result.healedTaskIds, [TASK_DONE]);

		const after = loadSpineBatchState(projectRoot).raw;
		const task = after?.tasks?.find((entry) => entry.taskId === TASK_DONE);
		assert.equal(task?.status, "succeeded");
		assert.equal(task?.doneFileFound, true);
		assert.equal(task?.exitReason, "done");
		assert.notEqual(after?.phase, "failed");
		assert.notEqual(after?.phase, "merge_blocked");
		assert.equal(after?.failedTasks, 0);
		assert.equal(after?.lanes?.[0]?.workerPid, undefined);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(
			events.some(
				(event) =>
					event.type === "task.completed" &&
					(event.taskId ?? event.payload?.taskId) === TASK_DONE &&
					(event.payload?.skippedDoneOnDisk === true || event.skippedDoneOnDisk === true),
			),
		);
		assert.equal(
			events.some(
				(event) =>
					event.type === "task.failed" &&
					(event.taskId ?? event.payload?.taskId) === TASK_DONE,
			),
			false,
		);

		const failedIds = (after.tasks ?? [])
			.filter((entry) => entry.status === "failed")
			.map((entry) => entry.taskId);
		assert.equal(failedIds.includes(TASK_DONE), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("engine orphan: heals DONE lane, fails sibling without .DONE", async () => {
	const projectRoot = await initGitRepo("spine-657-mixed-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({
			projectRoot,
			batchId: BATCH_ID,
			laneNumber: 1,
			orchBranch,
		});
		const lane2 = provisionLaneWorktree({
			projectRoot,
			batchId: BATCH_ID,
			laneNumber: 2,
			orchBranch,
		});
		const doneFolder = writeCommittedDoneInLane(projectRoot, lane1.worktreePath, TASK_DONE);
		const otherFolder = `spine-tasks/${TASK_OTHER}-orphan`;

		const state = createInitialBatchState({
			batchId: BATCH_ID,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[TASK_DONE, TASK_OTHER]],
			tasks: [
				{
					taskId: TASK_DONE,
					laneNumber: 1,
					status: "running",
					taskFolder: doneFolder,
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
				{
					taskId: TASK_OTHER,
					laneNumber: 2,
					status: "running",
					taskFolder: otherFolder,
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
					branch: laneTaskBranch(BATCH_ID, 1),
					taskIds: [TASK_DONE],
					workerPid: DEAD_PID,
					lastHeartbeatAt: Date.now() - 120_000,
				},
				{
					laneNumber: 2,
					laneId: "lane-2",
					worktreePath: lane2.worktreePath,
					branch: laneTaskBranch(BATCH_ID, 2),
					taskIds: [TASK_OTHER],
					workerPid: DEAD_PID,
					lastHeartbeatAt: Date.now() - 120_000,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		for (const taskId of [TASK_DONE, TASK_OTHER]) {
			appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
				taskId,
				laneNumber: taskId === TASK_DONE ? 1 : 2,
			});
		}

		const result = reconcileOrphanRunningState({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
		});
		assert.equal(result.reconciled, true);
		assert.deepEqual(result.healedTaskIds, [TASK_DONE]);

		const after = loadSpineBatchState(projectRoot).raw;
		assert.equal(after?.tasks?.find((task) => task.taskId === TASK_DONE)?.status, "succeeded");
		assert.equal(after?.tasks?.find((task) => task.taskId === TASK_OTHER)?.status, "failed");
		assert.equal(after?.phase, "failed");
		assert.equal(after?.failedTasks, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
