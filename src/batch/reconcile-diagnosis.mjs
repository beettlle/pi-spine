/** Diagnosis derivation (SP-596/SP-606 / #192). */

import { inferLaunchFailureKind } from "./diagnosis.mjs";
import {
	REVIEW_INFRASTRUCTURE_EXIT_REASONS,
	resolvePrimaryFailureExitReason,
	resolveTaskPrimaryFailureExitReason,
} from "./diagnosis-review-infra.mjs";
import {
	findPendingLaneLandTasks,
	shouldDiagnosePendingLaneLand,
} from "./diagnosis-pending-lane.mjs";
import { inferWorkerDoneMissingFailure } from "./diagnosis-worker-done-missing.mjs";
import { inferStubExitReasonForTask } from "./diagnosis-stub.mjs";
import { isPostMergeLimbo } from "./limbo-detect.mjs";
import {
	LIMBO_PHASES,
	RUNNING_PHASES,
} from "./reconcile-light-cache.mjs";
export { buildReconcileDiagnosisContext } from "./reconcile-diagnosis-context.mjs";
export {
	enrichLaunchFailureFromWorkerOutput,
	enrichWorkerDoneMissingContext,
	extractGitignoredPathsFromJournal,
	hasGhostRunningCluster,
	laneTaskBranchForDiagnosis,
} from "./reconcile-diagnosis-enrich.mjs";

/**
 * @param {string|null} failedTaskId
 * @param {string|null} exitReason
 * @param {Record<string, any>} signals
 * @returns {{ exitReason: string|null, launchFailureKind: string|null }}
 */
function deriveFailureContext(failedTaskId, exitReason, signals) {
	let resolvedExitReason =
		exitReason ?? resolvePrimaryFailureExitReason(failedTaskId, signals);
	if (failedTaskId && signals.tasksRoot) {
		const taskFolder =
			signals.tasks?.find((/** @type {any} */ entry) => entry.taskId === failedTaskId)?.taskFolder ?? null;
		const stubReason = inferStubExitReasonForTask(signals.tasksRoot, failedTaskId, taskFolder);
		if (stubReason) {
			resolvedExitReason = stubReason;
		}
	}
	const launchFailureKind = inferLaunchFailureKind({
		exitReason: resolvedExitReason,
		journalEvents: signals.journalEvents,
		failedTaskId,
	});
	return { exitReason: resolvedExitReason, launchFailureKind };
}

/**
 * @param {string} diagnosis
 * @param {string|null} failedTaskId
 * @param {Record<string, any>} signals
 * @param {string|null} [exitReason]
 */
function withFailureContext(diagnosis, failedTaskId, signals, exitReason = null) {
	const context = deriveFailureContext(failedTaskId, exitReason, signals);
	return {
		diagnosis,
		failedTaskId,
		exitReason: context.exitReason,
		launchFailureKind: context.launchFailureKind,
	};
}

/**
 * @param {Record<string, any>} signals
 */
function findNeedsReplanTask(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return (
		tasks.find(
			(/** @type {any} */ task) =>
				task?.exitReason === "needs_replan" &&
				(task.status === "failed" || task.classification === "terminal-failure"),
		) ?? null
	);
}

/**
 * @param {Record<string, any>} signals
 */
function hasNeedsReplanBlocker(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return tasks.some((/** @type {any} */ task) => task?.exitReason === "needs_replan");
}

/**
 * Failed task whose lane work already completed (done evidence / `.DONE` in
 * the lane worktree) but whose engine review (plan, code, or final) failed to
 * spawn, timed out, or hit a provider error — no verdict was ever produced
 * (SP-821 / #334). Such tasks get re-review guidance, not salvage: the retry
 * command resumes at the review (`runWorker` no-ops on existing `.DONE`),
 * whereas `salvage --integrate` lands code no reviewer saw. This reverses the
 * SP-762 pending_lane_land mapping for the plan-review case (#291) and
 * extends the shared reason set to code/final and provider errors.
 *
 * Parsed batch-state tasks drop `exitReason` (normalizeTasks), so the exit
 * reason is resolved the same way deriveFailureContext resolves it: from the
 * task entry when present, else raw state / journal `task.failed` events.
 *
 * @param {Record<string, any>} signals
 * @returns {Record<string, any>|null}
 */
function findPostDoneReviewInfraFailedTask(signals) {
	const tasks = Array.isArray(signals.tasks) ? signals.tasks : [];
	for (const task of tasks) {
		if (String(task?.status ?? "").toLowerCase() !== "failed") continue;
		const hasDoneEvidence =
			task?.doneInLane === true ||
			task?.doneOnMain === true ||
			task?.doneFileFound === true ||
			String(task?.classification ?? "").toLowerCase() === "terminal-success";
		if (!hasDoneEvidence) continue;
		const exitReason = resolveTaskPrimaryFailureExitReason(task, signals);
		if (!REVIEW_INFRASTRUCTURE_EXIT_REASONS.has(String(exitReason ?? ""))) continue;
		return task;
	}
	return null;
}

/**
 * @param {Record<string, any>} signals
 */
export function deriveDiagnosis(signals) {
	const {
		phase,
		endedAt,
		failedTasks,
		allTasksTerminalSuccess,
		hasRunningTasks,
		hasPendingTasks,
		hasFailedTasks,
		hasSegmentDrift,
		failedTaskId,
		mergeResultsEmpty,
		git,
		orphanRunning,
	} = signals;

	if (orphanRunning) {
		if (orphanRunning.kind === "lane" && orphanRunning.taskId) {
			return withFailureContext("worker_orphaned", orphanRunning.taskId, signals);
		}
		return withFailureContext("engine_orphaned", orphanRunning.taskId ?? null, signals);
	}

	if (shouldDiagnosePendingLaneLand(signals)) {
		const pendingLaneLandTasks = /** @type {any} */ (findPendingLaneLandTasks(signals.tasks));
		return withFailureContext(
			"pending_lane_land",
			pendingLaneLandTasks[0]?.taskId ?? null,
			signals,
		);
	}

	if (signals.stateDrift?.drifted) {
		const driftTask = signals.stateDrift.entries.find((/** @type {any} */ entry) => entry.taskId !== "*");
		return withFailureContext("state_drift", driftTask?.taskId ?? null, signals);
	}

	if (
		!hasRunningTasks &&
		hasPendingTasks &&
		Array.isArray(signals.tasks) &&
		signals.tasks.some(
			(/** @type {any} */ task) =>
				task?.doneInLane === true &&
				(task.status === "pending" || task.status === "running" || task.classification === "pending" || task.classification === "running"),
		)
	) {
		const driftTask = signals.tasks.find((/** @type {any} */ task) => task?.doneInLane);
		return withFailureContext("needs_retry", driftTask?.taskId ?? null, signals);
	}

	if (git?.gitInspectionError) {
		return withFailureContext("git_unavailable", null, signals);
	}

	if (phase === "aborted") {
		return withFailureContext("aborted", null, signals);
	}
	if (phase === "completed" && endedAt != null) {
		if (git.orchBranchExists && !git.orchMergedToBase) {
			return withFailureContext("needs_integrate", null, signals);
		}
		return withFailureContext("completed", null, signals);
	}

	const limboSignals =
		allTasksTerminalSuccess &&
		failedTasks === 0 &&
		LIMBO_PHASES.has(phase) &&
		endedAt == null &&
		mergeResultsEmpty;

	if (limboSignals && git.orchMergedToBase) {
		return withFailureContext("completed_manual", null, signals);
	}

	if (limboSignals) {
		return withFailureContext("limbo_stale", null, signals);
	}

	if (hasFailedTasks || hasSegmentDrift) {
		const replanTask = findNeedsReplanTask(signals);
		if (replanTask) {
			return withFailureContext(
				"needs_replan",
				replanTask.taskId ?? failedTaskId,
				signals,
				"needs_replan",
			);
		}
		const doneMissing = inferWorkerDoneMissingFailure({
			journalEvents: signals.journalEvents,
			failedTaskId,
		});
		if (doneMissing) {
			return withFailureContext("worker_done_missing", failedTaskId, signals);
		}
		// Post-DONE review-infrastructure failure (plan/code/final spawn failure,
		// timeout, or provider error): lane work is complete but no verdict was
		// produced. Map to needs_retry — `spine batch retry` resumes at the review
		// because runWorker no-ops on the existing lane .DONE. Salvage --integrate
		// would land code no reviewer saw (SP-821 / #334, reversing SP-762).
		const postDoneReviewInfraTask = findPostDoneReviewInfraFailedTask(signals);
		if (postDoneReviewInfraTask) {
			return withFailureContext(
				"needs_retry",
				postDoneReviewInfraTask.taskId ?? failedTaskId,
				signals,
			);
		}
		return withFailureContext("needs_retry", failedTaskId, signals);
	}

	if (hasNeedsReplanBlocker(signals)) {
		const replanTask = findNeedsReplanTask(signals);
		return withFailureContext(
			"needs_replan",
			replanTask?.taskId ?? failedTaskId,
			signals,
			"needs_replan",
		);
	}

	const postMergeLimbo = isPostMergeLimbo(signals.raw ?? {}, git);
	signals.postMergeLimbo = postMergeLimbo;

	if (postMergeLimbo) {
		return withFailureContext("needs_integrate", null, signals);
	}

	if (phase === "merge_blocked") {
		return withFailureContext("failed", null, signals);
	}

	if (
		phase === "merging" &&
		endedAt != null &&
		Array.isArray(signals.raw?.mergeResults) &&
		signals.raw.mergeResults.some((/** @type {any} */ entry) => String(entry?.status ?? "").toLowerCase() === "failed")
	) {
		return withFailureContext("failed", null, signals);
	}

	if (phase === "merging" || (allTasksTerminalSuccess && mergeResultsEmpty && git.orchBranchExists && !git.orchMergedToBase)) {
		if (allTasksTerminalSuccess && git.orchBranchExists && !git.orchMergedToBase && !mergeResultsEmpty) {
			return withFailureContext("needs_integrate", null, signals);
		}
		return withFailureContext("needs_merge", null, signals);
	}

	if (allTasksTerminalSuccess && git.orchBranchExists && !git.orchMergedToBase && mergeResultsEmpty) {
		return withFailureContext("needs_integrate", null, signals);
	}

	if (
		phase === "failed" &&
		!hasFailedTasks &&
		!hasSegmentDrift &&
		hasPendingTasks
	) {
		return withFailureContext("needs_retry", null, signals);
	}

	if (
		phase === "failed" &&
		!hasFailedTasks &&
		!hasSegmentDrift &&
		allTasksTerminalSuccess &&
		mergeResultsEmpty
	) {
		return withFailureContext("needs_merge", null, signals);
	}

	if (phase === "failed" || (failedTasks > 0 && !hasPendingTasks && !hasRunningTasks)) {
		return withFailureContext("failed", failedTaskId, signals);
	}

	if (phase === "paused") {
		return withFailureContext("paused", null, signals);
	}

	// Terminal-success land loop waiting for an integrate gate while the engine phase
	// is still "running". Mark post-merge limbo so downstream suggestedCommand and
	// macro-phase treat this as gate-ready rather than falling through to "running" (#221).
	if (
		RUNNING_PHASES.has(phase) &&
		allTasksTerminalSuccess &&
		git.orchBranchExists &&
		!git.orchMergedToBase &&
		!hasRunningTasks &&
		!hasPendingTasks
	) {
		signals.postMergeLimbo = true;
		return withFailureContext("needs_integrate", null, signals);
	}

	if (RUNNING_PHASES.has(phase) || hasRunningTasks || hasPendingTasks) {
		return withFailureContext("running", null, signals);
	}

	return withFailureContext("paused", null, signals);
}
