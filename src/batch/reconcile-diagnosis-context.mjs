// @ts-nocheck
/** Diagnosis output context after reconcile signal enrichment (#201 / SP-645). */

import { findPendingLaneLandTasks } from "./diagnosis-pending-lane.mjs";

/**
 * @param {object} params
 */
export function buildReconcileDiagnosisContext(params) {
	const {
		batch,
		git,
		signals,
		classifiedTasks,
		diagnosis: _diagnosis,
		failedTaskId,
		driftTaskStatus,
		exitReason,
		resolvedLaunchFailureKind,
		pendingTaskCount,
		salvageChangedFileCount,
		salvageRetryCommand,
		ghostRunningCluster,
		integrateGateOpen,
		stalePathSpine,
		planReviewNestedSpawnBlocked,
		mergeGitignoredFailure,
		mergeFailedForHeadline,
		mergeFailureSummary,
		taskBranch,
		gitignoredPaths,
		hasRunningTasks,
		hasPendingTasks,
		macroPhase,
		reviewHonorSignal,
		doneMissingContext,
		engineOrphanCause,
		staleEnginePid,
		enginePid,
		engineStillRunning,
		humanBaseSync,
	} = params;

	const pendingLaneLandTasks = findPendingLaneLandTasks(classifiedTasks);

	return {
		batchId: batch.batchId,
		baseBranch: batch.baseBranch ?? git.baseBranch ?? "main",
		pendingLaneLandTasks,
		phase: batch.phase,
		failedTasks: signals.failedTasks,
		failedTaskId,
		driftTaskStatus,
		exitReason,
		launchFailureKind: resolvedLaunchFailureKind,
		gitMerged: git.orchMergedToBase,
		pendingTaskCount,
		salvageChangedFileCount,
		salvageRetryCommand,
		ghostRunningCluster,
		postMergeLimbo: signals.postMergeLimbo === true,
		integrateGateOpen,
		stalePathSpine,
		planReviewNestedSpawnBlocked,
		mergeGitignoredFailure,
		mergeFailed: mergeFailedForHeadline,
		failedWaveIndex: mergeFailureSummary.failedWaveIndex,
		failedLane: mergeFailureSummary.failedLane,
		lastError: mergeFailureSummary.lastError,
		succeededTasks: batch.succeededTasks,
		totalTasks: batch.totalTasks,
		taskBranch,
		gitignoredPaths,
		hasRunningTasks,
		hasPendingTasks,
		allTasksTerminalSuccess: signals.allTasksTerminalSuccess,
		tasksRoot: signals.tasksRoot,
		macroPhase,
		reviewHonorSignal,
		...(doneMissingContext ?? {}),
		engineOrphanCause,
		staleEnginePid,
		enginePid,
		engineStillRunning,
		humanBaseSync,
		overlapPaths: humanBaseSync?.overlapPaths ?? [],
	};
}
