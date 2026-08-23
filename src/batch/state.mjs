// @ts-nocheck
/**
 * pi-spine batch-state.json orchestration (schema v1, PRD §10.1).
 * Re-export shim — I/O in state-io.mjs, guards in state-guards.mjs (SP-587).
 */

import { appendJournalEvent } from "./journal.mjs";
import {
	clearStaleTerminalBatchStateForStart,
	loadBatchStateFile,
} from "./batch-state-io.mjs";
import {
	loadSpineBatchState,
	saveSpineBatchState,
} from "./state-io.mjs";
import { ACTIVE_PHASES } from "./state-guards.mjs";

export {
	SPINE_BATCH_STATE_REL,
	BATCH_HISTORY_REL,
	spineBatchStatePath,
	loadSpineBatchState,
	saveSpineBatchState,
	batchHistoryPath,
	resolveBatchStateFileForValidation,
	appendBatchHistoryEntry,
} from "./state-io.mjs";
export {
	ACTIVE_PHASES,
	TERMINAL_BATCH_PHASES,
	evaluateBatchStateWriteGuard,
	readBatchEnginePid,
	recordBatchEnginePid,
	clearBatchEnginePid,
	validateBatchState,
} from "./state-guards.mjs";
export {
	BATCH_ID_PATTERN,
	batchIdRejectionReason,
	generateBatchId,
	isValidBatchId,
	validateBatchId,
} from "./batch-id.mjs";

/**
 * Reset lane stall clocks at resume handoff so dashboard does not show pre-resume heartbeats as stale.
 *
 * @param {object} state
 */
export function refreshLaneHeartbeatsOnResume(state) {
	const resilience =
		state.resilience && typeof state.resilience === "object" ? state.resilience : {};
	const reference =
		Number(resilience.engineStartedAt) > 0 ? Number(resilience.engineStartedAt) : Date.now();
	for (const lane of state.lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		lane.lastHeartbeatAt = reference;
	}
}

/**
 * Mark running tasks that lost their worker when the engine exits unexpectedly.
 *
 * @param {object} state
 * @param {string} [exitReason]
 */
export function reconcileGhostRunningTasks(state, exitReason = "engine_crashed") {
	const now = Date.now();
	for (const task of state.tasks ?? []) {
		if (!task || task.status !== "running") continue;
		task.status = "failed";
		task.endedAt = now;
		task.exitReason = task.exitReason ?? exitReason;
		updateSegmentForTask(state, task.taskId, "failed");
	}

	for (const lane of state.lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		delete lane.workerPid;
	}

	const tasks = state.tasks ?? [];
	state.succeededTasks = tasks.filter((task) => task?.status === "succeeded").length;
	state.failedTasks = tasks.filter((task) => task?.status === "failed").length;
	state.skippedTasks = tasks.filter((task) => task?.status === "skipped").length;
}

/**
 * Fail closed when the detached resume engine throws: terminal journal, phase, ghost cleanup.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {unknown} params.error
 * @param {string|null} [params.taskId]
 * @param {number|null} [params.laneNumber]
 */
export function failBatchFromEngineError({
	projectRoot,
	state,
	batchId,
	error,
	taskId = null,
	laneNumber = null,
}) {
	const message = error instanceof Error ? error.message : String(error);
	const fromPhase = String(state.phase ?? "running");

	reconcileGhostRunningTasks(state);
	state.endedAt = Date.now();
	state.lastError = message.slice(0, 500);
	state.phase = "failed";

	appendJournalEvent(projectRoot, batchId, "batch.failed", {
		fromPhase,
		toPhase: "failed",
		reason: "engine_error",
		error: message,
		taskId,
		laneNumber,
	});

	saveSpineBatchState(projectRoot, state);
}

/**
 * @param {string} projectRoot
 */
export function assertNoActiveBatch(projectRoot) {
	clearStaleTerminalBatchStateForStart(projectRoot);

	const spine = loadSpineBatchState(projectRoot);
	if (spine.path && spine.raw) {
		const phase = String(spine.raw.phase ?? "");
		if (ACTIVE_PHASES.has(phase)) {
			throw new Error(
				`Active pi-spine batch ${spine.raw.batchId} (phase=${phase}). Run spine batch dismiss or complete first.`,
			);
		}
	}

	const any = loadBatchStateFile(projectRoot);
	if (any.path && any.raw) {
		const phase = String(any.raw.phase ?? "");
		const active =
			ACTIVE_PHASES.has(phase) || phase === "executing" || phase === "merging" || phase === "stopped";
		if (active && !any.raw.endedAt) {
			throw new Error(
				`Active batch ${any.raw.batchId} at ${any.path} (phase=${phase}). Dismiss or abort before spine batch start.`,
			);
		}
	}
}

/**
 * @param {string} taskId
 */
export function defaultSegmentId(taskId) {
	return `${taskId}::default`;
}

/**
 * @param {Array<{ taskId: string }>} tasks
 */
export function buildSegmentsFromTasks(tasks) {
	return tasks.map((task) => ({
		segmentId: defaultSegmentId(task.taskId),
		taskId: task.taskId,
		status: "pending",
		repoId: "default",
	}));
}

/**
 * @param {object} state
 * @param {string} taskId
 * @param {string} status
 */
export function updateSegmentForTask(state, taskId, status) {
	if (!Array.isArray(state.segments)) return;
	for (const segment of state.segments) {
		if (segment && typeof segment === "object" && segment.taskId === taskId) {
			segment.status = status;
		}
	}
}

/**
 * @param {object} task
 */
export function clearTaskFailureMetadata(task) {
	if (!task || typeof task !== "object") return;
	task.exitReason = null;
	if ("classification" in task) delete task.classification;
}

/**
 * @param {object} state
 */
export function recomputeTaskCounters(state) {
	const tasks = state.tasks ?? [];
	state.succeededTasks = tasks.filter((task) => task?.status === "succeeded").length;
	state.failedTasks = tasks.filter((task) => task?.status === "failed").length;
	state.skippedTasks = tasks.filter((task) => task?.status === "skipped").length;
}

/**
 * @param {object} state
 * @param {string} taskId
 * @returns {{ previousClassification: string, wasFailed: boolean } | null}
 */
export function resetTaskForRetry(state, taskId) {
	const task = (state.tasks ?? []).find(
		(entry) => entry && typeof entry === "object" && entry.taskId === taskId,
	);
	if (!task) return null;

	const previousClassification = String(task.status ?? "unknown");
	const wasFailed = task.status === "failed";

	clearTaskFailureMetadata(task);
	task.status = "pending";
	task.startedAt = null;
	task.endedAt = null;
	task.doneFileFound = false;

	for (const segment of state.segments ?? []) {
		if (!segment || segment.taskId !== taskId) continue;
		segment.status = "pending";
		if ("startedAt" in segment) segment.startedAt = null;
		if ("endedAt" in segment) segment.endedAt = null;
		if ("exitReason" in segment) segment.exitReason = null;
		if ("classification" in segment) delete segment.classification;
	}

	state.blockedTaskIds = (state.blockedTaskIds ?? []).filter((id) => id !== taskId);
	recomputeTaskCounters(state);

	return { previousClassification, wasFailed };
}

/**
 * @param {object} state
 * @param {string} taskId
 * @param {object} [options]
 * @param {string} [options.exitReason]
 * @param {boolean} [options.doneFileFound]
 * @param {number|null} [options.endedAt]
 * @param {number|null} [options.startedAt]
 * @returns {boolean}
 */
export function recordTaskSucceeded(state, taskId, options = {}) {
	const task = (state.tasks ?? []).find(
		(entry) => entry && typeof entry === "object" && entry.taskId === taskId,
	);
	if (!task) return false;

	const exitReason = options.exitReason ?? "done";
	const doneFileFound = options.doneFileFound ?? true;
	const endedAt = options.endedAt ?? Date.now();
	const startedAt = options.startedAt ?? null;

	if ("classification" in task) delete task.classification;
	task.status = "succeeded";
	task.endedAt = endedAt;
	task.doneFileFound = doneFileFound;
	task.exitReason = exitReason;
	if (startedAt != null && !task.startedAt) task.startedAt = startedAt;

	updateSegmentForTask(state, taskId, "succeeded");
	recomputeTaskCounters(state);
	return true;
}

/**
 * Single write path: persist batch-state then append matching journal event (FR-REL-04).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.journalType
 * @param {Record<string, unknown>} [params.journalPayload]
 */
export function recordTaskTransition({
	projectRoot,
	state,
	journalType,
	journalPayload = {},
}) {
	const batchId = String(state.batchId ?? "");
	saveSpineBatchState(projectRoot, state);
	if (!batchId) return state;
	appendJournalEvent(projectRoot, batchId, journalType, journalPayload);
	return state;
}

/**
 * @param {object} state
 * @param {string} [taskId]
 */
export function countPendingSegments(state, taskId = null) {
	const segments = Array.isArray(state.segments) ? state.segments : [];
	return segments.filter((segment) => {
		if (!segment || typeof segment !== "object") return false;
		if (taskId && segment.taskId !== taskId) return false;
		const status = String(segment.status ?? "pending").toLowerCase();
		return status === "pending" || status === "running";
	}).length;
}

/**
 * @param {object} params
 */
export function createInitialBatchState({
	batchId,
	baseBranch,
	orchBranch,
	wavePlan,
	tasks,
	lanes,
}) {
	const now = Date.now();
	return {
		schemaVersion: 1,
		phase: "planning",
		batchId,
		baseBranch,
		orchBranch,
		startedAt: now,
		updatedAt: now,
		endedAt: null,
		currentWaveIndex: 0,
		totalWaves: wavePlan.length,
		wavePlan,
		lanes: lanes.map((lane) => ({ ...lane, lastHeartbeatAt: lane.lastHeartbeatAt ?? null })),
		tasks,
		segments: buildSegmentsFromTasks(tasks),
		mergeResults: [],
		totalTasks: tasks.length,
		succeededTasks: 0,
		failedTasks: 0,
		skippedTasks: 0,
		blockedTasks: 0,
		blockedTaskIds: [],
		lastError: null,
		resilience: {
			resumeForced: false,
			retryCountByScope: {},
			lastFailureClass: null,
			repairHistory: [],
		},
	};
}
