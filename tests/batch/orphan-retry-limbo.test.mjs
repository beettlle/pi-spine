/**
 * SP-647 — dead-engine multi-lane orphan: retry/abort clear limbo without runtime surgery (#203 + SP-646).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { abortBatch } from "../../src/batch/abort.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { retryTask, skipTask } from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	readBatchEnginePid,
	recordBatchEnginePid,
	saveSpineBatchState,
	spineBatchStatePath,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const BATCH_ID = "20260712T234002";

/**
 * #203 signal shape: dead engine, stale multi-lane workers, tasks still running.
 *
 * @param {string} projectRoot
 * @param {object} [options]
 */
function seedDeadEngineMultiLaneOrphan(projectRoot, options = {}) {
	const runningTasks = options.runningTasks ?? [
		{ taskId: "SP-641", laneNumber: 1 },
		{ taskId: "SP-642", laneNumber: 2 },
		{ taskId: "SP-643", laneNumber: 3 },
		{ taskId: "SP-644", laneNumber: 4 },
	];
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [runningTasks.map((task) => task.taskId)],
		tasks: runningTasks.map((task) => ({
			taskId: task.taskId,
			laneNumber: task.laneNumber,
			status: "running",
			taskFolder: `spine-tasks/${task.taskId}-orphan`,
			startedAt: Date.now(),
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		})),
		lanes: runningTasks.map((task) => ({
			laneNumber: task.laneNumber,
			laneId: `lane-${task.laneNumber}`,
			worktreePath: laneWorktreePath(projectRoot, BATCH_ID, task.laneNumber),
			branch: laneTaskBranch(BATCH_ID, task.laneNumber),
			taskIds: [task.taskId],
			lastHeartbeatAt: Date.now() - 120_000,
			workerPid: DEAD_PID,
		})),
	});
	state.phase = "running";
	recordBatchEnginePid(state, DEAD_PID);
	saveSpineBatchState(projectRoot, state);

	for (const task of runningTasks) {
		appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
			taskId: task.taskId,
			laneNumber: task.laneNumber,
		});
		appendJournalEvent(projectRoot, BATCH_ID, "lane.heartbeat", {
			laneNumber: task.laneNumber,
			taskId: task.taskId,
		});
	}

	return { runningTasks };
}

test("diagnose then retry: engine_orphaned suggestedCommand clears multi-lane limbo (#203)", async () => {
	const projectRoot = await initGitRepo("spine-647-diagnose-retry-");
	try {
		seedDeadEngineMultiLaneOrphan(projectRoot);

		const diagnosis = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(diagnosis.diagnosis, "engine_orphaned");
		assert.equal(diagnosis.suggestedCommand, "spine batch retry SP-641");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "running");

		const retry = retryTask({ projectRoot, taskId: "SP-641" });
		assert.equal(retry.ok, true, retry.output ?? retry.error);

		const after = loadSpineBatchState(projectRoot).raw;
		assert.notEqual(after?.phase, "running");
		assert.equal(after?.tasks?.find((task) => task.taskId === "SP-641")?.status, "pending");
		assert.equal(
			after?.tasks?.filter((task) => task.status === "failed").length,
			3,
			"other ghost running tasks fail on engine orphan reconcile",
		);
		assert.equal(readBatchEnginePid(after), null);
		assert.equal(after?.lanes?.every((lane) => lane.workerPid == null), true);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
		assert.ok(
			events.some(
				(event) =>
					event.type === "task.failed" &&
					(event.taskId ?? event.payload?.taskId) === "SP-642" &&
					(event.payload?.reason ?? event.reason) === "engine_orphaned",
			),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask on dead-engine multi-lane orphan does not require pause or runtime edits", async () => {
	const projectRoot = await initGitRepo("spine-647-retry-limbo-");
	try {
		seedDeadEngineMultiLaneOrphan(projectRoot);
		assert.equal(isProcessAlive(DEAD_PID), false);

		const retry = retryTask({ projectRoot, taskId: "SP-641" });
		assert.equal(retry.ok, true, retry.output ?? retry.error);
		assert.match(retry.output ?? "", /spine batch resume --force/);

		const after = loadSpineBatchState(projectRoot).raw;
		assert.equal(after?.phase, "failed");
		assert.equal(after?.failedTasks, 3);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("abortBatch succeeds on dead-engine multi-lane running limbo without runtime surgery", async () => {
	const projectRoot = await initGitRepo("spine-647-abort-limbo-");
	try {
		seedDeadEngineMultiLaneOrphan(projectRoot);
		const activePath = spineBatchStatePath(projectRoot);
		assert.ok(activePath);

		const result = abortBatch({ projectRoot, reason: "operator abort" });
		assert.equal(result.ok, true, result.headline ?? result.error);
		assert.equal(result.diagnosis, "aborted");
		assert.equal(loadSpineBatchState(projectRoot).raw, null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTask succeeds on dead-engine orphan after reconcile (SP-647)", async () => {
	const projectRoot = await initGitRepo("spine-647-skip-orphan-");
	try {
		seedDeadEngineMultiLaneOrphan(projectRoot, {
			runningTasks: [{ taskId: "SP-641", laneNumber: 1 }],
		});

		const skip = skipTask({ projectRoot, taskId: "SP-641" });
		assert.equal(skip.ok, true, skip.output ?? skip.error);

		const after = loadSpineBatchState(projectRoot).raw;
		assert.equal(after?.tasks?.[0]?.status, "skipped");
		assert.notEqual(after?.phase, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask fail-closed when engine and worker are alive", async () => {
	const projectRoot = await initGitRepo("spine-647-fail-closed-");
	try {
		const taskId = "SP-647";
		const state = createInitialBatchState({
			batchId: "20260713T020202",
			baseBranch: "main",
			orchBranch: "orch/spine-20260713T020202",
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${taskId}`,
					startedAt: Date.now(),
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, "20260713T020202", 1),
					branch: laneTaskBranch("20260713T020202", 1),
					taskIds: [taskId],
					lastHeartbeatAt: Date.now(),
					workerPid: process.pid,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);

		const retry = retryTask({ projectRoot, taskId });
		assert.equal(retry.ok, false);
		assert.equal(retry.error, "cannot_retry");
		assert.match(retry.output ?? "", /phase is running/i);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
