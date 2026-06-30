import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";
import { isFailedPhasePendingOnlyLimbo } from "../../src/batch/diagnosis-retry-limbo.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import { validateMultiTaskResume } from "../../src/batch/resume-multi-validate.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { checkNoActiveBatch } from "../../src/config/spine-preflight-lib.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/** Optimator batch 20260622T220028 / GitHub #25 — worker died, retry left failed-phase limbo. */
function writeIssue25FailedBatch(projectRoot, { batchId = "20260622T220028", taskId = "SP-010" } = {}) {
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
				status: "failed",
				taskFolder: `spine-tasks/${taskId}-smoke`,
				startedAt: Date.now() - 120_000,
				endedAt: Date.now() - 60_000,
				doneFileFound: false,
				exitReason: "worker_failed",
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
	state.phase = "failed";
	state.failedTasks = 1;
	state.endedAt = Date.now();
	state.lastError = "worker subprocess died";
	state.resilience = {
		retryCountByScope: {},
		lastFailureClass: "worker_failed",
	};
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "lane.died", {
		taskId,
		laneNumber: 1,
		laneId: "lane-1",
	});
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber: 1,
		laneId: "lane-1",
		classification: "worker_failed",
		exitCode: 1,
	});
	appendJournalEvent(projectRoot, batchId, "batch.failed", {
		failedTaskId: taskId,
	});

	return { batchId, taskId, state };
}

test("issue #25: retry unblocks failed phase when only pending tasks remain", async () => {
	const projectRoot = await initGitRepo("spine-retry-failed-phase-");
	try {
		const { batchId, taskId } = writeIssue25FailedBatch(projectRoot);

		const before = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(before.diagnosis, "needs_retry");

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.unblocked, true);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.phase, "paused");
		assert.equal(saved?.failedTasks, 0);
		assert.equal(saved?.tasks[0].status, "pending");
		assert.equal(saved?.endedAt, null);
		assert.equal(saved?.lastError, null);
		assert.equal(saved?.resilience?.lastFailureClass, null);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
		assert.ok(events.some((event) => event.type === "batch.retry_unblocked"));

		const reconcile = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconcile.diagnosis, "paused");
		assert.equal(reconcile.suggestedCommand, "spine batch resume");

		const resumeCheck = validateMultiTaskResume({ projectRoot, force: false });
		assert.equal(resumeCheck.ok, true, resumeCheck.output ?? resumeCheck.error);

		const preflight = checkNoActiveBatch({ projectRoot });
		assert.equal(preflight.ok, false);
		assert.match(preflight.message ?? "", /paused/i);
		assert.equal(preflight.suggestedCommand, "spine batch resume");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("issue #25: failed phase with pending-only limbo resumes without --force", async () => {
	const projectRoot = await initGitRepo("spine-retry-failed-limbo-resume-");
	try {
		const { taskId } = writeIssue25FailedBatch(projectRoot);

		retryTask({ projectRoot, taskId });
		const saved = loadSpineBatchState(projectRoot).raw;
		saved.phase = "failed";
		saveSpineBatchState(projectRoot, saved);

		const reconcile = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconcile.diagnosis, "needs_retry");
		assert.equal(reconcile.suggestedCommand, "spine batch resume --force");

		const resumeCheck = validateMultiTaskResume({ projectRoot, force: false });
		assert.equal(resumeCheck.ok, true, resumeCheck.output ?? resumeCheck.error);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retry keeps failed phase when other failed tasks remain", async () => {
	const projectRoot = await initGitRepo("spine-retry-partial-failed-");
	try {
		const batchId = "20260630T120000";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["TP-A", "TP-B"]],
			tasks: [
				{
					taskId: "TP-A",
					laneNumber: 1,
					status: "failed",
					taskFolder: "spine-tasks/TP-A-smoke",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: false,
					exitReason: "worker_failed",
				},
				{
					taskId: "TP-B",
					laneNumber: 2,
					status: "failed",
					taskFolder: "spine-tasks/TP-B-smoke",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: false,
					exitReason: "worker_failed",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: lane1.worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["TP-A"],
					lastHeartbeatAt: null,
				},
				{
					laneNumber: 2,
					laneId: "lane-2",
					worktreePath: lane2.worktreePath,
					branch: laneTaskBranch(batchId, 2),
					taskIds: ["TP-B"],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "failed";
		state.failedTasks = 2;
		updateSegmentForTask(state, "TP-A", "failed");
		updateSegmentForTask(state, "TP-B", "failed");
		saveSpineBatchState(projectRoot, state);

		const result = retryTask({ projectRoot, taskId: "TP-A" });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.unblocked, false);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.phase, "failed");
		assert.equal(saved?.failedTasks, 1);
		assert.equal(saved?.tasks.find((task) => task.taskId === "TP-A")?.status, "pending");
		assert.equal(saved?.tasks.find((task) => task.taskId === "TP-B")?.status, "failed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("diagnosis suggests resume --force for failed-phase pending-only limbo", () => {
	assert.equal(
		isFailedPhasePendingOnlyLimbo({
			phase: "failed",
			failedTasks: 0,
			pendingTaskCount: 1,
			failedTaskId: null,
		}),
		true,
	);
	const command = buildSuggestedCommand("needs_retry", {
		batchId: "20260622T220028",
		phase: "failed",
		failedTasks: 0,
		pendingTaskCount: 1,
		failedTaskId: null,
	});
	assert.equal(command, "spine batch resume --force");
});
