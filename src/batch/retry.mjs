// @ts-nocheck
/**
 * Atomic task retry and skip (TP-017, PRD §18.5, FR-BATCH-09/10).
 */

import { reconcileOrphanRunningState } from "./reconcile.mjs";
import {
	clearTaskFailureMetadata,
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
 * Fail running tasks and clear dead engine/worker PIDs before retry/skip (#203 / SP-647).
 *
 * @param {string} projectRoot
 * @param {object} state
 */
function reconcileOrphanBeforeTaskMutation(projectRoot, state) {
	return reconcileOrphanRunningState({ projectRoot, state });
}

/**
 * Shared preamble for task/row mutations: load batch state, reconcile orphan
 * running state, reload. Returns the live state or a ready-to-return error.
 *
 * @param {string} projectRoot
 * @returns {{ ok: true, state: object } | { ok: false, result: { ok: false, exitCode: number, error: string, output: string } }}
 */
export function loadMutableBatch(projectRoot) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return {
			ok: false,
			result: { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" },
		};
	}

	reconcileOrphanBeforeTaskMutation(projectRoot, loaded.raw);

	const reloaded = loadSpineBatchState(projectRoot);
	const state = reloaded.raw;
	if (!state) {
		return {
			ok: false,
			result: { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" },
		};
	}
	return { ok: true, state };
}

/**
 * Phase guard shared by retry/skip at task and row scope. `operation` only
 * shapes the error text ("retry" vs "skip"); the phase sets are shared.
 *
 * @param {object} params
 * @param {string} params.phase
 * @param {"retry" | "skip"} params.operation
 * @returns {{ ok: true } | { ok: false, error: string, output: string, batchId?: string, phase: string }}
 */
export function guardPhaseForMutation({ phase, operation }) {
	const verb = operation === "skip" ? "skip" : "retry";
	if (RETRY_BLOCKED_PHASES.has(phase)) {
		return {
			ok: false,
			error: `cannot_${verb}`,
			output: `Cannot ${verb} task while batch phase is ${phase}. Pause the batch first.\n`,
			phase,
		};
	}
	if (operation === "retry" && !RETRY_ALLOWED_PHASES.has(phase)) {
		return {
			ok: false,
			error: "cannot_retry",
			output: `Cannot retry task in batch phase ${phase}. Retry is allowed in paused or failed batches.\n`,
			phase,
		};
	}
	return { ok: true };
}

/**
 * Flip a matrix task's `failed` rows back to `pending` for a whole-task retry
 * while preserving `succeeded` rows (never re-executed — #230) and `canceled`
 * rows (operator exclusion wins).
 *
 * @param {object} task
 * @returns {string[]} Row ids reset for re-execution.
 */
function resetMatrixRowsForRetry(task) {
	const rows = Array.isArray(task?.matrixRows) ? task.matrixRows : [];
	/** @type {string[]} */
	const retried = [];
	for (const row of rows) {
		if (!row || typeof row !== "object") continue;
		if (row.status === "failed") {
			row.status = "pending";
			row.exitCode = null;
			retried.push(row.rowId);
		}
	}
	return retried;
}

/**
 * @param {object} state
 * @param {string} taskId
 */
export function findTask(state, taskId) {
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
 * After skip clears the last failed task, leave failed-phase limbo (GitHub #96).
 *
 * @param {object} state
 * @param {string} previousPhase
 * @returns {boolean}
 */
export function unblockBatchAfterSkip(state, previousPhase) {
	if (Number(state.failedTasks ?? 0) > 0) return false;

	state.lastError = null;
	state.resilience = state.resilience ?? {};
	state.resilience.lastFailureClass = null;
	state.endedAt = null;

	const allTerminal = (state.tasks ?? []).every((entry) => {
		const status = String(entry?.status ?? "");
		return status === "succeeded" || status === "skipped";
	});

	if (allTerminal) {
		if ((state.mergeResults ?? []).length === 0) {
			state.phase = "paused";
		} else {
			state.phase = "completed";
			state.endedAt = Date.now();
		}
		return true;
	}

	if (previousPhase === "failed") {
		state.phase = "paused";
		return true;
	}

	return false;
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
	const loadedBatch = loadMutableBatch(projectRoot);
	if (!loadedBatch.ok) return loadedBatch.result;
	const state = loadedBatch.state;
	const phase = String(state.phase ?? "");

	const guard = guardPhaseForMutation({ phase, operation: "retry" });
	if (!guard.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: guard.error,
			output: guard.output,
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

	// Matrix tasks (#230): succeeded rows carry over (never re-executed) and
	// canceled rows stay excluded — only failed rows re-enter the sweep.
	const retriedRowIds = resetMatrixRowsForRetry(task);

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
	// The shared preamble already reloaded state, so the live phase is `phase`.
	const previousPhase = phase;
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.retry_requested",
		journalPayload: {
			taskId,
			previousClassification: reset.previousClassification,
			pendingSegments,
			...(retriedRowIds.length > 0 ? { retriedRowIds } : {}),
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

	let output = `Task ${taskId} reset for retry (pendingSegments=${pendingSegments}).`;
	if (retriedRowIds.length > 0) {
		output += `\n  Matrix rows re-running: ${retriedRowIds.join(", ")} (succeeded rows carry over).`;
	}
	output += `\n  → ${resumeHint}\n`;

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		taskId,
		pendingSegments,
		unblocked,
		...(retriedRowIds.length > 0 ? { retriedRowIds } : {}),
		output,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskId
 */
export function skipTask({ projectRoot, taskId }) {
	const loadedBatch = loadMutableBatch(projectRoot);
	if (!loadedBatch.ok) return loadedBatch.result;
	const state = loadedBatch.state;
	const phase = String(state.phase ?? "");

	const guard = guardPhaseForMutation({ phase, operation: "skip" });
	if (!guard.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: guard.error,
			output: guard.output,
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

	clearTaskFailureMetadata(task);
	task.status = "skipped";
	task.endedAt = Date.now();
	task.exitReason = "skipped_by_operator";
	updateSegmentForTask(state, taskId, "skipped");

	state.blockedTaskIds = (state.blockedTaskIds ?? []).filter((id) => id !== taskId);
	recomputeTaskCounters(state);
	unblockBatchAfterSkip(state, phase);

	const allTerminal = (state.tasks ?? []).every((entry) => {
		const status = String(entry?.status ?? "");
		return status === "succeeded" || status === "skipped";
	});

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

