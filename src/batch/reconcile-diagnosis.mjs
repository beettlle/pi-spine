// @ts-nocheck
/** Diagnosis derivation (SP-596/SP-606 / #192). */

import { inferLaunchFailureKind } from "./diagnosis.mjs";
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
 * @param {unknown} rawTasks
 * @param {string|null} failedTaskId
 * @returns {string|null}
 */
function resolveFailedExitReason(rawTasks, failedTaskId) {
	if (!failedTaskId || !Array.isArray(rawTasks)) return null;
	const match = rawTasks.find((entry) => {
		if (!entry || typeof entry !== "object") return false;
		return String(entry.taskId ?? entry.id ?? "") === failedTaskId;
	});
	if (!match || typeof match !== "object") return null;
	const exitReason = /** @type {{ exitReason?: unknown }} */ (match).exitReason;
	return typeof exitReason === "string" && exitReason ? exitReason : null;
}

/**
 * @param {string|null} failedTaskId
 * @param {object} signals
 * @returns {string|null}
 */
function resolvePrimaryFailureExitReason(failedTaskId, signals) {
	const fromTask = resolveFailedExitReason(signals.raw?.tasks, failedTaskId);
	if (fromTask) return fromTask;
	if (!failedTaskId) return null;
	if (Array.isArray(signals.segments)) {
		const segment = signals.segments.find((entry) => entry?.taskId === failedTaskId);
		const classification = segment?.classification;
		if (
			typeof classification === "string" &&
			classification &&
			classification !== "terminal-failure"
		) {
			return classification;
		}
	}
	if (Array.isArray(signals.journalEvents)) {
		for (let index = signals.journalEvents.length - 1; index >= 0; index -= 1) {
			const event = signals.journalEvents[index];
			if (event.type !== "task.failed") continue;
			const eventTaskId = event.taskId ?? event.payload?.taskId;
			if (eventTaskId !== failedTaskId) continue;
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			const reason = payload.exitReason ?? payload.classification;
			if (typeof reason === "string" && reason) return reason;
		}
	}
	return null;
}

/**
 * @param {string|null} failedTaskId
 * @param {string|null} exitReason
 * @param {object} signals
 * @returns {{ exitReason: string|null, launchFailureKind: string|null }}
 */
function deriveFailureContext(failedTaskId, exitReason, signals) {
	let resolvedExitReason =
		exitReason ?? resolvePrimaryFailureExitReason(failedTaskId, signals);
	if (failedTaskId && signals.tasksRoot) {
		const taskFolder =
			signals.tasks?.find((entry) => entry.taskId === failedTaskId)?.taskFolder ?? null;
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
 * @param {object} signals
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
 * @param {object} signals
 */
function findNeedsReplanTask(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return (
		tasks.find(
			(task) =>
				task?.exitReason === "needs_replan" &&
				(task.status === "failed" || task.classification === "terminal-failure"),
		) ?? null
	);
}

/**
 * @param {object} signals
 */
function hasNeedsReplanBlocker(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return tasks.some((task) => task?.exitReason === "needs_replan");
}

/**
 * Plan-review exit reasons where reviewer infrastructure failed after the
 * worker had already completed its lane work (#291 / SP-762). Mirrors the
 * SP-718 final-review distinction: spawn failure / timeout mean no verdict
 * was produced — the implementation itself is not the failure.
 */
const POST_DONE_PLAN_REVIEW_EXIT_REASONS = new Set([
	"plan_review_spawn_failed",
	"plan_review_timeout",
]);

/**
 * Failed task whose lane work already completed (done evidence / `.DONE` in
 * the lane worktree) but whose engine plan review failed to spawn or timed
 * out. Such tasks are salvageable land-loop candidates — a full worker retry
 * would re-run expensive work that is already on disk (#291 / SP-762).
 *
 * Parsed batch-state tasks drop `exitReason` (normalizeTasks), so the exit
 * reason is resolved the same way deriveFailureContext resolves it: from the
 * task entry when present, else raw state / journal `task.failed` events.
 * The salvage command itself hard-gates on commits-ahead, so pointing at it
 * without lane commits is safe (dry-run reports none salvageable).
 *
 * @param {object} signals
 * @returns {object|null}
 */
function findPostDonePlanReviewSpawnFailedTask(signals) {
	const tasks = Array.isArray(signals.tasks) ? signals.tasks : [];
	for (const task of tasks) {
		if (String(task?.status ?? "").toLowerCase() !== "failed") continue;
		const hasDoneEvidence =
			task?.doneInLane === true ||
			task?.doneOnMain === true ||
			task?.doneFileFound === true ||
			String(task?.classification ?? "").toLowerCase() === "terminal-success";
		if (!hasDoneEvidence) continue;
		const taskId = String(task?.taskId ?? "");
		const exitReason = task?.exitReason ?? resolvePrimaryFailureExitReason(taskId, signals);
		if (!POST_DONE_PLAN_REVIEW_EXIT_REASONS.has(String(exitReason ?? ""))) continue;
		return task;
	}
	return null;
}

/**
 * @param {object} signals
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
		const pendingLaneLandTasks = findPendingLaneLandTasks(signals.tasks);
		return withFailureContext(
			"pending_lane_land",
			pendingLaneLandTasks[0]?.taskId ?? null,
			signals,
		);
	}

	if (signals.stateDrift?.drifted) {
		const driftTask = signals.stateDrift.entries.find((entry) => entry.taskId !== "*");
		return withFailureContext("state_drift", driftTask?.taskId ?? null, signals);
	}

	if (
		!hasRunningTasks &&
		hasPendingTasks &&
		Array.isArray(signals.tasks) &&
		signals.tasks.some(
			(task) =>
				task?.doneInLane === true &&
				(task.status === "pending" || task.status === "running" || task.classification === "pending" || task.classification === "running"),
		)
	) {
		const driftTask = signals.tasks.find((task) => task?.doneInLane);
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
		// Post-DONE plan-review spawn failure: lane work is complete, so map to
		// pending_lane_land (salvage / land-loop guidance) instead of needs_retry,
		// whose retry language would force an expensive worker re-run (#291 / SP-762).
		const postDonePlanReviewTask = findPostDonePlanReviewSpawnFailedTask(signals);
		if (postDonePlanReviewTask) {
			return withFailureContext(
				"pending_lane_land",
				postDonePlanReviewTask.taskId ?? failedTaskId,
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
		signals.raw.mergeResults.some((entry) => String(entry?.status ?? "").toLowerCase() === "failed")
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
