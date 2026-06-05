/**
 * Per-lane task execution and wave queue wiring for multi-task resume (extracted from resume-multi.mjs).
 */

import path from "node:path";
import crypto from "node:crypto";
import {
	journalHasTaskCompleted,
	loadResumeFileScopePaths,
	recomputeTaskCounters,
	resolveTaskFolderInWorktree,
	taskAlreadyComplete,
} from "./resume-common.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { commitLaneWorktree, filterPorcelain, gitPorcelain } from "./lane-commit.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import { saveSpineBatchState, updateSegmentForTask } from "./state.mjs";
import { laneTaskBranch } from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";
import { isTaskResumable } from "./resume-multi-validate.mjs";

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
async function markTaskCompleteFromDisk({
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
	const ignorePatterns = Array.isArray(config?.worktreeSetupIgnorePaths)
		? config.worktreeSetupIgnorePaths
		: [];

	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
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
			skippedDoneOnDisk: true,
			taskFolder: taskFolderInWorktree,
		});
	}

	return { ok: true, skipped: true, taskId, laneNumber };
}

/**
 * @param {object} params
 */
async function runResumedTaskOnLane({
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

	const ignorePatterns = Array.isArray(config?.worktreeSetupIgnorePaths)
		? config.worktreeSetupIgnorePaths
		: [];
	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
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

/**
 * Build lane queues and run all tasks in a resume wave.
 *
 * @param {object} params
 * @returns {Promise<{ ok: true, waveResults: object[], batchAborted: boolean } | { ok: false, result: object }>}
 */
export async function executeResumeWave({
	projectRoot,
	state,
	batchId,
	config,
	tasksRootRel,
	waveIndex,
	waveTaskIds,
	events,
}) {
	/** @type {Map<number, { lane: object, runs: Array<{ taskId: string, run: () => Promise<object> }> }>} */
	const runsByLane = new Map();
	let batchAborted = false;

	for (const taskId of waveTaskIds) {
		const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
		if (!task) continue;

		const laneNumber = task.laneNumber;
		const lane = (state.lanes ?? []).find((entry) => entry.laneNumber === laneNumber);
		if (!lane) {
			return {
				ok: false,
				result: {
					ok: false,
					exitCode: 1,
					batchId,
					taskId,
					error: "lane_not_found",
					output: `No lane assigned for task ${taskId} (lane ${laneNumber}).\n`,
				},
			};
		}

		const taskFolderRel = task.taskFolder
			? path.isAbsolute(task.taskFolder)
				? path.relative(projectRoot, task.taskFolder)
				: task.taskFolder
			: path.join(tasksRootRel, `${taskId}-smoke`);
		const taskFolderInWorktree = resolveTaskFolderInWorktree({
			projectRoot,
			task,
			lane,
			tasksRootRel,
			batchId,
		});
		const laneCorrelationId = lane.correlationId ?? crypto.randomUUID();
		lane.correlationId = laneCorrelationId;

		if (!runsByLane.has(laneNumber)) {
			runsByLane.set(laneNumber, { lane, runs: [] });
		}
		const laneQueue = runsByLane.get(laneNumber);

		if (taskAlreadyComplete({ taskFolder: taskFolderInWorktree, events, task })) {
			laneQueue.runs.push({
				taskId,
				run: () =>
					markTaskCompleteFromDisk({
						projectRoot,
						state,
						batchId,
						config,
						task,
						lane,
						taskBranch: lane.branch ?? laneTaskBranch(batchId, laneNumber),
						taskFolderInWorktree,
						laneCorrelationId,
					}),
			});
			continue;
		}

		if (!isTaskResumable(state, task)) {
			continue;
		}

		laneQueue.runs.push({
			taskId,
			run: () =>
				runResumedTaskOnLane({
					projectRoot,
					state,
					batchId,
					config,
					task,
					lane,
					taskFolderRel,
					laneCorrelationId,
				}).then((result) => {
					if (result.aborted) batchAborted = true;
					return result;
				}),
		});
	}

	const laneExecutions = [...runsByLane.entries()].map(async ([laneNumber, { lane, runs }]) => {
		if (runs.length > 1) {
			appendJournalEvent(projectRoot, batchId, "lane.tasks_serialized", {
				laneNumber,
				laneId: lane.laneId,
				waveIndex,
				taskIds: runs.map((entry) => entry.taskId),
				correlationId: lane.correlationId ?? null,
			});
		}

		/** @type {object[]} */
		const laneResults = [];
		for (const { run } of runs) {
			const result = await run();
			laneResults.push(result);
			if (result.aborted) {
				batchAborted = true;
				return laneResults;
			}
		}
		return laneResults;
	});

	const waveResults = (await Promise.all(laneExecutions)).flat();
	return { ok: true, waveResults, batchAborted };
}
