import assert from "node:assert/strict";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import { detectSegmentDrift, retryTask, skipTask } from "../../src/batch/retry.mjs";
import {
	countPendingSegments,
	createInitialBatchState,
	defaultSegmentId,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeFailedSingleLaneBatch(projectRoot, { batchId = "20260601T170000", taskId = "TP-999" } = {}) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: `taskplane-tasks/${taskId}-smoke`,
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "worker_failed",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "failed";
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);
	return { state, batchId, taskId };
}

test("retryTask atomically resets task and segment records", async () => {
	const projectRoot = await initGitRepo("spine-retry-atomic-");
	try {
		const { batchId, taskId } = writeFailedSingleLaneBatch(projectRoot);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.pendingSegments, 1);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.phase, "failed");
		assert.equal(saved?.failedTasks, 0);
		assert.equal(saved?.tasks[0].status, "pending");
		assert.equal(saved?.tasks[0].startedAt, null);
		assert.equal(saved?.tasks[0].endedAt, null);
		assert.equal(saved?.tasks[0].exitReason, null);
		assert.equal(saved?.segments[0].status, "pending");
		assert.equal(countPendingSegments(saved, taskId), 1);

		const events = readJournalEvents(projectRoot, batchId);
		const retryEvent = events.find((event) => event.type === "task.retry_requested");
		assert.ok(retryEvent);
		assert.equal(retryEvent.taskId, taskId);
		assert.equal(retryEvent.payload?.pendingSegments, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask fixes segment drift (GAP-RETRY-01)", async () => {
	const projectRoot = await initGitRepo("spine-retry-drift-");
	try {
		const { batchId, taskId } = writeFailedSingleLaneBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.tasks[0].status = "pending";
		state.failedTasks = 0;
		saveSpineBatchState(projectRoot, state);
		assert.equal(detectSegmentDrift(state), true);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.segments[0].status, "pending");
		assert.equal(detectSegmentDrift(loadSpineBatchState(projectRoot).raw), false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch refuses segment drift without retry", async () => {
	const projectRoot = await initGitRepo("spine-retry-refuse-");
	try {
		const { taskId } = writeFailedSingleLaneBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.phase = "paused";
		state.tasks[0].status = "pending";
		state.failedTasks = 0;
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "RetrySegmentDrift");
		assert.match(result.output ?? "", new RegExp(taskId));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTask marks task skipped and updates counters", async () => {
	const projectRoot = await initGitRepo("spine-skip-task-");
	try {
		const { batchId, taskId } = writeFailedSingleLaneBatch(projectRoot);

		const result = skipTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].status, "skipped");
		assert.equal(saved?.segments[0].status, "skipped");
		assert.equal(saved?.failedTasks, 0);
		assert.equal(saved?.skippedTasks, 1);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.skipped"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask rejects when batch is running", async () => {
	const projectRoot = await initGitRepo("spine-retry-running-");
	try {
		const { taskId } = writeFailedSingleLaneBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, false);
		assert.equal(result.error, "cannot_retry");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("defaultSegmentId used in segment records", () => {
	assert.equal(defaultSegmentId("TP-017"), "TP-017::default");
});
