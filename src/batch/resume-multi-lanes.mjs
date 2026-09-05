// @ts-nocheck
/**
 * Per-lane task execution for multi-task resume (extracted from resume-multi.mjs).
 * Queue wiring lives in resume-multi-queue.mjs (SP-590); re-exported below.
 */

import path from "node:path";
import fs from "node:fs";
import {
	journalHasTaskCompleted,
	loadResumeFileScopePaths,
	recomputeTaskCounters,
} from "./resume-common.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { commitLaneWorktree, filterPorcelain, gitPorcelain } from "./lane-commit.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import { saveSpineBatchState, updateSegmentForTask } from "./state.mjs";
import { laneTaskBranch } from "./worktree.mjs";
import { laneDoneMarkerCommittedOnBranch } from "./journal-rebuild.mjs";
import { runWorker } from "./worker-host.mjs";
import { runMatrixTaskForResume } from "./engine-lanes/matrix-run.mjs";
import { runLaneReviewPhasesBeforeCommit } from "./resume-lane-reviews.mjs";

export { executeResumeWave } from "./resume-multi-queue.mjs";

/**
 * @param {object} params
 */
export function resetFailedTasksForForceResume({ state, pendingTasks }) {
	state.resilience = state.resilience ?? {};
	state.resilience.resumeForced = true;
	state.failedTasks = 0;

	for (const task of pendingTasks) {
		if (task.status !== "failed") continue;
		task.status = "pending";
		task.startedAt = null;
		task.endedAt = null;
		task.exitReason = null;
		task.doneFileFound = false;
		updateSegmentForTask(state, task.taskId, "pending");
	}
}

/**
 * @param {object} params
 */
export async function markTaskCompleteFromDisk({
	projectRoot,
	state,
	batchId,
	config,
	task,
	lane,
	taskBranch,
	taskFolderInWorktree,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranchResolved = taskBranch ?? laneTaskBranch(batchId, laneNumber);
	const scopeResult = loadResumeFileScopePaths(taskFolderInWorktree);
	const fileScopePaths = scopeResult.ok ? scopeResult.fileScopePaths : [];

	const reviewResult = await runLaneReviewPhasesBeforeCommit({
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch: taskBranchResolved,
		laneCorrelationId,
		fileScopePaths,
		baseBranch: state.baseBranch ?? "main",
	});
	if (!reviewResult.ok) {
		return {
			ok: false,
			error: reviewResult.error ?? "review_failed",
			output: reviewResult.output,
			taskId,
			laneNumber,
			exitCode: reviewResult.exitCode ?? 1,
		};
	}

	const ignorePatterns = Array.isArray(config?.worktreeSetupIgnorePaths)
		? config.worktreeSetupIgnorePaths
		: [];

	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch: taskBranchResolved,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
		projectRoot,
	});
	if (!laneCommit.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = laneCommit.failureClass ?? "lane_commit_failed";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: laneCommit.failureClass ?? "lane_commit_failed",
			exitCode: 1,
			output: laneCommit.error,
			resumed: true,
		});
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
			taskId,
			laneNumber,
		};
	}
	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber,
			commitSha: laneCommit.commitSha,
		});
	}

	const remainingDirty = filterPorcelain(gitPorcelain(wt), ignorePatterns);
	if (remainingDirty) {
		const dirtyOutput =
			"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output";
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "DirtyWorktree";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "DirtyWorktree",
			exitCode: 1,
			output: dirtyOutput,
			resumed: true,
		});
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output: dirtyOutput,
			taskId,
			laneNumber,
		};
	}

	const taskFolderRel = task.taskFolder;
	const doneOnDisk = fs.existsSync(path.join(taskFolderInWorktree, ".DONE"));
	if (
		doneOnDisk &&
		(!taskFolderRel ||
			!laneDoneMarkerCommittedOnBranch(projectRoot, taskBranchResolved, taskFolderRel))
	) {
		const output =
			`Lane task branch ${taskBranchResolved} lacks committed ${taskFolderRel ?? "<unknown>"}/.DONE — ` +
			"worker must create and commit .DONE before resume can promote";
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "done_marker_missing";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "done_marker_missing",
			exitCode: 1,
			output,
			resumed: true,
		});
		return {
			ok: false,
			error: "done_marker_missing",
			output,
			taskId,
			laneNumber,
		};
	}

	task.status = "succeeded";
	task.doneFileFound = true;
	task.exitReason = task.exitReason ?? "done";
	if (!task.endedAt) task.endedAt = Date.now();
	updateSegmentForTask(state, taskId, "succeeded");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);

	if (!journalHasTaskCompleted(readJournalEvents(projectRoot, batchId), taskId)) {
		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			resumed: true,
			...(doneOnDisk ? { skippedDoneOnDisk: true } : {}),
			taskFolder: taskFolderInWorktree,
		});
	}

	return { ok: true, skipped: true, taskId, laneNumber };
}

/**
 * @param {object} params
 */
export async function runResumedTaskOnLane({
	projectRoot,
	state,
	batchId,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranch = lane.branch ?? laneTaskBranch(batchId, laneNumber);
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	const scopeResult = loadResumeFileScopePaths(path.join(projectRoot, taskFolderRel));
	const fileScopePaths = scopeResult.ok ? scopeResult.fileScopePaths : [];

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		resumed: true,
	});

	// Matrix tasks resume through runMatrixTaskOnLane (row fan-out, carry-over,
	// lane commit, success recording) instead of a plain worker run (#230).
	const matrixResume = await runMatrixTaskForResume({
		projectRoot,
		state,
		batchId,
		baseBranch: state.baseBranch ?? "main",
		config,
		task,
		lane,
		taskFolderRel,
		laneCorrelationId,
		fileScopePaths,
	});
	if (matrixResume.isMatrix) {
		if (!matrixResume.ok) {
			const classification = matrixResume.cliResult?.error ?? "matrix_failed";
			appendJournalEvent(projectRoot, batchId, "lane.died", {
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				reason: classification,
			});
			return { ok: false, aborted: false, workerResult: matrixResume.cliResult, taskId, laneNumber };
		}
		// The matrix runner already lane-committed, recorded success, and journaled.
		return { ok: true, taskId, laneNumber };
	}

	const workerResult = await runWorker({
		worktreePath: wt,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneBranch: taskBranch,
		laneCorrelationId,
		fileScopePaths,
		config,
		onHeartbeat: (timestamp) => {
			lane.lastHeartbeatAt = timestamp;
			saveSpineBatchState(projectRoot, state);
		},
		onWorkerPid: (pid) => {
			if (pid > 0) {
				lane.workerPid = pid;
				saveSpineBatchState(projectRoot, state);
			}
		},
	});

	if (!workerResult.ok) {
		const aborted = workerResult.classification === "aborted";
		appendJournalEvent(projectRoot, batchId, "lane.died", {
			laneNumber,
			laneId: lane.laneId,
			taskId,
			correlationId: laneCorrelationId,
			reason: workerResult.classification ?? "worker_failed",
		});
		task.status = aborted ? "aborted" : "failed";
		task.endedAt = Date.now();
		task.exitReason = workerResult.classification ?? "worker_failed";
		updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		if (!aborted) {
			const salvageFields = recordTaskFailureSalvage({
				projectRoot,
				batchId,
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				worktreePath: wt,
				fileScopePaths,
				taskFolder: taskFolderInWorktree,
				workerResult,
				config,
				batchPhase: state.phase,
				taskBranch,
			});
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				...workerResult,
				...salvageFields,
			});
		}
		return { ok: false, aborted, workerResult, taskId, laneNumber };
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});

	const reviewResult = await runLaneReviewPhasesBeforeCommit({
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch,
		laneCorrelationId,
		fileScopePaths,
		baseBranch: state.baseBranch ?? "main",
	});
	if (!reviewResult.ok) {
		return {
			ok: false,
			error: reviewResult.error ?? "review_failed",
			output: reviewResult.output,
			taskId,
			laneNumber,
			exitCode: reviewResult.exitCode ?? 1,
		};
	}

	const ignorePatterns = Array.isArray(config?.worktreeSetupIgnorePaths)
		? config.worktreeSetupIgnorePaths
		: [];
	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
		projectRoot,
	});
	if (!laneCommit.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = laneCommit.failureClass ?? "lane_commit_failed";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: laneCommit.failureClass ?? "lane_commit_failed",
			exitCode: 1,
			output: laneCommit.error,
			resumed: true,
		});
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
			taskId,
			laneNumber,
		};
	}
	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber,
			commitSha: laneCommit.commitSha,
		});
	}

	const remainingDirty = filterPorcelain(gitPorcelain(wt), ignorePatterns);
	if (remainingDirty) {
		const dirtyOutput =
			"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output";
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "DirtyWorktree";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "DirtyWorktree",
			exitCode: 1,
			output: dirtyOutput,
			resumed: true,
		});
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output: dirtyOutput,
			taskId,
			laneNumber,
		};
	}

	task.status = "succeeded";
	task.endedAt = Date.now();
	task.doneFileFound = true;
	task.exitReason = "done";
	updateSegmentForTask(state, taskId, "succeeded");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.completed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
	});

	return { ok: true, taskId, laneNumber };
}
