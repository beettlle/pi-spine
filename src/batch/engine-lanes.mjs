// @ts-nocheck
/**
 * Lane task execution facade — re-exports split modules and phase transitions.
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
import { runCodeReviewPhase, runFinalReviewPhase } from "./engine-lanes/review.mjs";
import { syncLaneWorktreeFromOrch } from "./worktree.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import { discoverTasks, loadDependenciesJson } from "../tasks/packet/index.mjs";

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
	tryAutoResolveMergeConflicts,
	tryAutoResolveRulesManifestMergeConflict,
} from "./engine-lanes/merge.mjs";

export { syncLaneWorktreeFromOrch } from "./worktree.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [config]
 */
function resolveBatchTasksRoot(projectRoot, config) {
	return resolveTasksRootPath(projectRoot, config) ?? path.join(projectRoot, "spine-tasks");
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {object[]} [stateTasks]
 */
function resolveTaskFolderPath(tasksRoot, taskId, stateTasks = []) {
	const fromState = stateTasks.find((entry) => entry?.taskId === taskId)?.taskFolder;
	if (typeof fromState === "string" && fromState.trim() && fs.existsSync(fromState)) {
		return fromState;
	}
	if (!fs.existsSync(tasksRoot)) return null;
	const match = discoverTasks(tasksRoot).find((entry) => entry.taskId === taskId);
	return match?.folderPath ?? null;
}

/**
 * Satisfied deps that share at least one File Scope path with the current task.
 * Used to decide whether the lane must sync orch before start (FR-REL231-03).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.taskId
 * @param {string[]} params.fileScopePaths
 * @param {object} [params.config]
 * @returns {Array<{ depId: string, overlap: string[] }>}
 */
export function collectSharedScopeSatisfiedDeps({
	projectRoot,
	state,
	taskId,
	fileScopePaths,
	config = {},
}) {
	if (!Array.isArray(fileScopePaths) || fileScopePaths.length === 0) return [];

	const tasksRoot = resolveBatchTasksRoot(projectRoot, config);
	const depsJson = loadDependenciesJson(tasksRoot);
	const deps = depsJson.tasks?.[taskId] ?? [];
	if (!Array.isArray(deps) || deps.length === 0) return [];

	const scopeSet = new Set(fileScopePaths);
	const stateTasks = Array.isArray(state?.tasks) ? state.tasks : [];
	/** @type {Array<{ depId: string, overlap: string[] }>} */
	const shared = [];

	for (const depId of deps) {
		const depTask = stateTasks.find((entry) => entry?.taskId === depId);
		if (!depTask || depTask.status !== "succeeded") continue;

		const depFolder = resolveTaskFolderPath(tasksRoot, depId, stateTasks);
		if (!depFolder) continue;

		const scopeResult = loadTaskFileScopePaths(depFolder);
		if (!scopeResult.ok) continue;

		const overlap = (scopeResult.fileScopePaths ?? []).filter((filePath) =>
			scopeSet.has(filePath),
		);
		if (overlap.length > 0) {
			shared.push({ depId, overlap });
		}
	}

	return shared;
}

/**
 * @param {object} params
 * @returns {{ ok: true, synced: boolean, skipped?: boolean, sharedDeps: Array<{ depId: string, overlap: string[] }>, headSha?: string } | { ok: false, error: string, sharedDeps: Array<{ depId: string, overlap: string[] }> }}
 */
export function ensureLaneSyncedForSharedScopeDeps({
	projectRoot,
	state,
	taskId,
	fileScopePaths,
	worktreePath,
	config = {},
}) {
	const sharedDeps = collectSharedScopeSatisfiedDeps({
		projectRoot,
		state,
		taskId,
		fileScopePaths,
		config,
	});
	if (sharedDeps.length === 0) {
		return { ok: true, synced: false, skipped: true, sharedDeps };
	}

	const orchBranch = state?.orchBranch;
	try {
		const result = syncLaneWorktreeFromOrch({
			worktreePath,
			orchBranch,
			projectRoot,
		});
		return {
			ok: true,
			synced: !result.skipped,
			skipped: result.skipped,
			sharedDeps,
			headSha: result.headSha,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message, sharedDeps };
	}
}
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
