/** Diagnosis output context after reconcile signal enrichment (#201 / SP-645). */

import { findPendingLaneLandTasks } from "./diagnosis-pending-lane.mjs";

/**
 * @param {Record<string, any>} params
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

	// SP-810 (partial #329): surface the persisted quota-fallback hop and the
	// latest quota-exhaustion journal payload so SBAR Background/Assessment can
	// tell operators the real quota situation. Journal events are reused from
	// signals.journalEvents (reconcileBatch already read them) — never a second
	// journal read here. Payloads follow the SP-808 shapes: worker.quota_exhausted
	// carries a single poolId/resetAtRaw; batch.quota_fallback_exhausted carries
	// parallel exhaustedPools[]/resetAtRaw[] arrays.
	const quotaFallbackRaw = signals.raw?.resilience?.quotaFallback;
	const quotaFallback = quotaFallbackRaw && typeof quotaFallbackRaw === "object" ? quotaFallbackRaw : null;
	const journalEvents = Array.isArray(signals.journalEvents) ? signals.journalEvents : [];
	let lastQuotaExhausted = null;
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event?.type !== "worker.quota_exhausted" && event?.type !== "batch.quota_fallback_exhausted") {
			continue;
		}
		lastQuotaExhausted = event.payload && typeof event.payload === "object" ? event.payload : {};
		break;
	}

	return {
		batchId: batch.batchId,
		baseBranch: batch.baseBranch ?? git.baseBranch ?? "main",
		pendingLaneLandTasks,
		phase: batch.phase,
		failedTasks: signals.failedTasks,
		failedTaskId,
		quotaFallback,
		lastQuotaExhausted,
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
