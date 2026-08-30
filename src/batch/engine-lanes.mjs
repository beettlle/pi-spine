// @ts-nocheck
/**
 * Lane task execution facade — re-exports split modules and phase transitions.
 *
 * Cycle-free ownership (#267 / SP-736): this facade participates in no batch import
 * cycle and must stay that way. It must not import from the resume/limbo/reconcile
 * cluster (resume-multi.mjs, post-merge-limbo.mjs, reconcile*.mjs, gate.mjs) —
 * resume entry points (resume.mjs) import this facade, never the reverse. Lane-phase
 * helpers live under engine-lanes/* leaves (queue, merge, review, matrix, commit,
 * orch-sync). `tests/arch/import-cycles.test.mjs` enforces this with an empty
 * ALLOWED_CLUSTER_CYCLES.
 */

import fs from "node:fs";
import path from "node:path";
import {
	loadTaskFileScopePaths,
	recordLaneTaskMetric,
	recordPromptParseFailure,
} from "./engine-lanes/queue.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { commitLaneAndValidateWorktree } from "./engine-lanes/commit.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import { saveEngineBatchState } from "./pause.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	updateSegmentForTask,
} from "./state.mjs";
import { runWorker } from "./worker-host.mjs";
import { runCodeReviewPhase, runFinalReviewPhase, runPlanReviewPhase } from "./engine-lanes/review.mjs";
import { ensureLaneSyncedForSharedScopeDeps } from "./engine-lanes/orch-sync.mjs";
import { resolveWorktreeSetupIgnorePaths } from "../config/spine-config-load.mjs";
import {
	acquireLaneSlot,
	loadMatrixTaskRows,
	releaseLaneSlot,
} from "./engine-lanes/matrix.mjs";
import { runMatrixTaskOnLane } from "./engine-lanes/matrix-run.mjs";

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
	runEnginePlanReview,
} from "./engine-lanes/review.mjs";

export {
	mergeLaneToOrch,
	mergeWaveLanesToOrch,
	resolveRulesManifestIntegrateDrift,
	tryAutoResolveMergeConflicts,
	tryAutoResolveRulesManifestMergeConflict,
} from "./engine-lanes/merge.mjs";

export { syncLaneWorktreeFromOrch } from "./worktree.mjs";
export {
	collectSharedScopeSatisfiedDeps,
	ensureLaneSyncedForSharedScopeDeps,
} from "./engine-lanes/orch-sync.mjs";

export {
	acquireLaneSlot,
	aggregateMatrixOutcomes,
	isMatrixSubLaneWorktreeDir,
	loadMatrixTaskRows,
	matrixSubLaneBranch,
	matrixWorktreeDir,
	matrixWorktreePath,
	provisionMatrixSubLaneWorktree,
	releaseLaneSlot,
	removeAllMatrixSubLaneWorktrees,
	removeMatrixSubLaneWorktree,
	runConcurrent,
	runMatrixSubLaneSetupHook,
	runShellInDir,
} from "./engine-lanes/matrix.mjs";

export { runMatrixTaskOnLane, runMatrixSubLane } from "./engine-lanes/matrix-run.mjs";

export { transitionPhase } from "./engine-lanes/phase.mjs";

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

	// Matrix tasks fan out into per-row lane-pool competitors (SP-697 / #228,
	// supersedes the SP-690 nested throttle). The parent lane is NOT held during
	// the sweep: each active row acquires a slot from the global pool inside
	// runMatrixTaskOnLane. Non-matrix tasks hold one slot for their whole
	// duration below, so rows and sibling lanes compete for the same pool and
	// global in-flight workers never exceed `lanes.maxParallel`.
	const matrixRows = loadMatrixTaskRows(path.join(projectRoot, taskFolderRel));
	if (matrixRows) {
		return runMatrixTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch,
			config,
			task,
			lane,
			taskFolderRel,
			laneCorrelationId,
			fileScopePaths,
			matrix: matrixRows,
			maxParallel: config?.lanes?.maxParallel ?? 1,
		});
	}

	const laneSlot = await acquireLaneSlot(state, config?.lanes?.maxParallel ?? 1);
	try {
		return await runNonMatrixTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch,
			config,
			task,
			lane,
			taskFolderRel,
			laneCorrelationId,
			fileScopePaths,
		});
	} finally {
		releaseLaneSlot(state, laneSlot);
	}
}

/**
 * Single-worker (non-matrix) lane task path. Caller holds a global lane slot
 * for the duration of this call.
 *
 * @param {object} params
 */
async function runNonMatrixTaskOnLane({
	projectRoot,
	state,
	batchId,
	baseBranch,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
	fileScopePaths,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranch = lane.branch;
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	const syncResult = ensureLaneSyncedForSharedScopeDeps({
		projectRoot,
		state,
		taskId,
		fileScopePaths,
		worktreePath: wt,
		config,
	});
	if (!syncResult.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "orch_sync_failed";
		if (!task.startedAt) task.startedAt = Date.now();
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveEngineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "lane.orch_sync_failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			error: syncResult.error,
			sharedDeps: syncResult.sharedDeps,
		});
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "orch_sync_failed",
			exitCode: 1,
			output: syncResult.error,
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
			workerResult: {
				ok: false,
				classification: "orch_sync_failed",
				output: syncResult.error,
				exitCode: 1,
			},
		};
	}
	if (syncResult.synced) {
		appendJournalEvent(projectRoot, batchId, "lane.orch_synced", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			orchBranch: state.orchBranch,
			headSha: syncResult.headSha,
			sharedDeps: syncResult.sharedDeps,
		});
	}

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveEngineBatchState(projectRoot, state);
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
			saveEngineBatchState(projectRoot, state);
		},
		onWorkerPid: (pid) => {
			if (pid > 0) {
				lane.workerPid = pid;
				saveEngineBatchState(projectRoot, state);
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
				saveEngineBatchState(projectRoot, state);
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
			saveEngineBatchState(projectRoot, state);
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

	if (lane.workerPid) {
		delete lane.workerPid;
		saveEngineBatchState(projectRoot, state);
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});

	const planReview = await runPlanReviewPhase({
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
	if (!planReview.ok) {
		return planReview;
	}

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

	const ignorePatterns = resolveWorktreeSetupIgnorePaths(config);
	const commitResult = commitLaneAndValidateWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		fileScopePaths,
		ignorePatterns,
		task,
		lane,
		laneNumber,
		laneCorrelationId,
		state,
		config,
	});
	if (!commitResult.ok) {
		return {
			ok: false,
			error: commitResult.error,
			output: commitResult.output,
		};
	}
	const { laneCommit } = commitResult;

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
