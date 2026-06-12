/**
 * Lane task execution facade — re-exports split modules and phase transitions.
 */

import fs from "node:fs";
import path from "node:path";
import {
	buildTasksAndLanesFromPlan,
	loadTaskFileScopePaths,
	recordLaneTaskMetric,
	recordPromptParseFailure,
	skipTaskDoneOnDisk,
} from "./engine-lanes/queue.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	commitLaneWorktree,
	filterPorcelain,
	gitPorcelain,
} from "./lane-commit.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { runWorker } from "./worker-host.mjs";
import { runCodeReviewPhase, runFinalReviewPhase } from "./engine-lanes/review.mjs";

export {
	buildTasksAndLanesFromPlan,
	loadTaskFileScopePaths,
	skipTaskDoneOnDisk,
} from "./engine-lanes/queue.mjs";

export {
	buildFinalReviewArtifactPath,
	parseFinalReviewVerdict,
	shouldRunCodeReview,
	shouldRunFinalReview,
	runEngineFinalReview,
	runEngineCodeReview,
} from "./engine-lanes/review.mjs";

export {
	mergeLaneToOrch,
	mergeWaveLanesToOrch,
	resolveRulesManifestIntegrateDrift,
	tryAutoResolveRulesManifestMergeConflict,
} from "./engine-lanes/merge.mjs";

/**
 * @param {string} fromPhase
 * @param {string} toPhase
 */
function phaseTransitionEventType(fromPhase, toPhase) {
	if (fromPhase === "planning" && toPhase === "running") return "batch.started";
	if (toPhase === "completed") return "batch.completed";
	if (toPhase === "failed") return "batch.failed";
	if (toPhase === "aborted") return "batch.aborted";
	return null;
}

/**
 * @param {object} params
 */
function recordPhaseTransition({ projectRoot, batchId, fromPhase, toPhase, extra = {} }) {
	const type = phaseTransitionEventType(fromPhase, toPhase);
	if (!type) return null;
	return appendJournalEvent(projectRoot, batchId, type, {
		fromPhase,
		toPhase,
		...extra,
	});
}

/**
 * @param {object} state
 * @param {string} newPhase
 * @param {object} ctx
 */
export function transitionPhase(state, newPhase, ctx) {
	const fromPhase = state.phase;
	if (fromPhase === newPhase) return;
	state.phase = newPhase;
	recordPhaseTransition({
		projectRoot: ctx.projectRoot,
		batchId: ctx.batchId,
		fromPhase,
		toPhase: newPhase,
		...ctx.extra,
	});
}

export async function runTaskOnLane({
	projectRoot,
	state,
	batchId,
	baseBranch,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranch = lane.branch;
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	const scopeResult = loadTaskFileScopePaths(path.join(projectRoot, taskFolderRel));
	if (!scopeResult.ok) {
		return recordPromptParseFailure({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			laneCorrelationId,
			scopeResult,
			config,
			taskFolderPath: path.join(projectRoot, taskFolderRel),
		});
	}
	const fileScopePaths = scopeResult.fileScopePaths;

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
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
		const doneOnDisk = fs.existsSync(path.join(taskFolderInWorktree, ".DONE"));
		const orphanSalvage =
			doneOnDisk &&
			(workerResult.doneFound === true || workerResult.classification === "stall_timeout");
		if (orphanSalvage) {
			appendJournalEvent(projectRoot, batchId, "worker.orphan_salvaged", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				classification: workerResult.classification ?? "worker_failed",
				doneOnDisk: true,
			});
			if (lane.workerPid) {
				delete lane.workerPid;
				saveSpineBatchState(projectRoot, state);
			}
		} else {
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
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return { ok: false, aborted, workerResult };
		}
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});

	const codeReview = await runCodeReviewPhase({
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
	});
	if (!codeReview.ok) {
		return codeReview;
	}

	const finalReview = await runFinalReviewPhase({
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
		baseBranch,
	});
	if (!finalReview.ok) {
		return finalReview;
	}

	if (process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT === "1") {
		const donePath = path.join(taskFolderInWorktree, ".DONE");
		if (fs.existsSync(donePath)) {
			fs.unlinkSync(donePath);
		}
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
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
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
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output: dirtyOutput,
		};
	}

	recordTaskSucceeded(state, taskId, { exitReason: "done", doneFileFound: true });
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.completed",
		journalPayload: {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
		},
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder: taskFolderInWorktree,
	});

	return { ok: true, laneCommit };
}
