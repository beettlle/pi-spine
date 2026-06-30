/**
 * Atomic task retry and skip (TP-017, PRD §18.5, FR-BATCH-09/10).
 */

import { reconcileOrphanRunningState } from "./reconcile.mjs";
import {
	countPendingSegments,
	loadSpineBatchState,
	recomputeTaskCounters,
	recordTaskTransition,
	resetTaskForRetry,
	updateSegmentForTask,
	validateBatchState,
} from "./state.mjs";

const RETRY_ALLOWED_PHASES = new Set(["paused", "failed"]);
const RETRY_BLOCKED_PHASES = new Set(["running", "planning"]);

/**
 * @param {object} state
 * @param {string} taskId
 */
function findTask(state, taskId) {
	return (state.tasks ?? []).find(
		(task) => task && typeof task === "object" && task.taskId === taskId,
	);
}

/**
 * When retry clears the last failed task, leave failed-phase limbo (GitHub #25).
 *
 * @param {object} state
 * @returns {boolean}
 */
export function unblockBatchAfterRetry(state) {
	if (Number(state.failedTasks ?? 0) > 0) return false;

	const hasPending = (state.tasks ?? []).some((task) => {
		const status = String(task?.status ?? "").toLowerCase();
		return status === "pending" || status === "running";
	});
	if (!hasPending) return false;

	state.phase = "paused";
	state.endedAt = null;
	state.lastError = null;
	state.resilience = state.resilience ?? {};
	state.resilience.lastFailureClass = null;
	return true;
}

/**
 * @param {object} state
 */
export function detectSegmentDrift(state) {
	return (state.tasks ?? []).some((task) => {
		if (!task || task.status !== "pending") return false;
		return (state.segments ?? []).some(
			(segment) =>
				segment &&
				segment.taskId === task.taskId &&
				(segment.status === "failed" || segment.status === "succeeded"),
		);
	});
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskId
 */
export function retryTask({ projectRoot, taskId }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	reconcileOrphanRunningState({ projectRoot, state: loaded.raw });

	const reloaded = loadSpineBatchState(projectRoot);
	const state = reloaded.raw;
	if (!state) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}
	const phase = String(state.phase ?? "");

	if (RETRY_BLOCKED_PHASES.has(phase)) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_retry",
			output: `Cannot retry task while batch phase is ${phase}. Pause the batch first.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	if (!RETRY_ALLOWED_PHASES.has(phase)) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_retry",
			output: `Cannot retry task in batch phase ${phase}. Retry is allowed in paused or failed batches.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	const validation = validateBatchState(state);
	if (!validation.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: "invalid_batch_state",
			output: `Batch state validation failed:\n  ${validation.errors.join("\n  ")}\n`,
			batchId: state.batchId,
		};
	}

	const task = findTask(state, taskId);
	if (!task) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_found",
			output: `Task ${taskId} not found in batch ${state.batchId}.\n`,
			batchId: state.batchId,
		};
	}

	const taskStatus = String(task.status ?? "");
	const segmentFailed = (state.segments ?? []).some(
		(segment) => segment?.taskId === taskId && segment.status === "failed",
	);
	if (taskStatus !== "failed" && !(taskStatus === "pending" && segmentFailed)) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_retryable",
			output: `Task ${taskId} is ${taskStatus} — only failed tasks (or pending with failed segments) can be retried.\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	const reset = resetTaskForRetry(state, taskId);
	if (!reset) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_found",
			output: `Task ${taskId} not found.\n`,
			batchId: state.batchId,
		};
	}

	const unblocked = unblockBatchAfterRetry(state);
	if (!unblocked) {
		state.phase = "failed";
		state.endedAt = null;
		state.lastError = null;
	}

	state.resilience = state.resilience ?? {};
	state.resilience.retryCountByScope = state.resilience.retryCountByScope ?? {};
	state.resilience.retryCountByScope[taskId] = (state.resilience.retryCountByScope[taskId] ?? 0) + 1;

	const pendingSegments = countPendingSegments(state, taskId);
	const previousPhase = String(reloaded.raw?.phase ?? phase);
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.retry_requested",
		journalPayload: {
			taskId,
			previousClassification: reset.previousClassification,
			pendingSegments,
		},
	});

	if (unblocked) {
		recordTaskTransition({
			projectRoot,
			state,
			journalType: "batch.retry_unblocked",
			journalPayload: {
				taskId,
				pendingSegments,
				fromPhase: previousPhase,
			},
		});
	}

	const resumeHint = unblocked ? "spine batch resume" : "spine batch resume --force";

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		taskId,
		pendingSegments,
		unblocked,
		output: `Task ${taskId} reset for retry (pendingSegments=${pendingSegments}).\n  → ${resumeHint}\n`,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskId
 */
export function skipTask({ projectRoot, taskId }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");

	if (RETRY_BLOCKED_PHASES.has(phase)) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_skip",
			output: `Cannot skip task while batch phase is ${phase}. Pause the batch first.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	const validation = validateBatchState(state);
	if (!validation.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: "invalid_batch_state",
			output: `Batch state validation failed:\n  ${validation.errors.join("\n  ")}\n`,
			batchId: state.batchId,
		};
	}

	const task = findTask(state, taskId);
	if (!task) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_found",
			output: `Task ${taskId} not found in batch ${state.batchId}.\n`,
			batchId: state.batchId,
		};
	}

	const taskStatus = String(task.status ?? "");
	if (taskStatus === "succeeded" || taskStatus === "skipped") {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_skippable",
			output: `Task ${taskId} is already ${taskStatus}.\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	task.status = "skipped";
	task.endedAt = Date.now();
	task.exitReason = "skipped_by_operator";
	updateSegmentForTask(state, taskId, "skipped");

	state.blockedTaskIds = (state.blockedTaskIds ?? []).filter((id) => id !== taskId);
	recomputeTaskCounters(state);

	const allTerminal = (state.tasks ?? []).every((entry) => {
		const status = String(entry?.status ?? "");
		return status === "succeeded" || status === "skipped";
	});

	if (allTerminal && state.mergeResults.length === 0) {
		state.phase = "failed";
		state.lastError = null;
	} else if (allTerminal) {
		state.phase = "completed";
		state.endedAt = Date.now();
	} else {
		state.phase = phase === "paused" ? "paused" : "failed";
	}

	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.skipped",
		journalPayload: {
			taskId,
			previousStatus: taskStatus,
		},
	});

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		taskId,
		output: allTerminal
			? `Task ${taskId} skipped. All batch tasks are terminal — resume or merge as needed.\n  → spine batch resume --force\n`
			: `Task ${taskId} skipped.\n  → spine batch resume --force\n`,
	};
}
