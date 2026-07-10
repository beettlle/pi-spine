// @ts-nocheck
/** Orphan reconcile helpers (SP-606 / #192). */

import {
	appendJournalEvent,
	readJournalEvents,
} from "./journal.mjs";
import {
	detectOrphanRunning,
	journalEventsSinceResume,
} from "./orphan-detect.mjs";
import { isProcessAlive } from "../process/liveness.mjs";
import {
	clearBatchEnginePid,
	readBatchEnginePid,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { reconcileBatch } from "./reconcile-batch.mjs";

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {object|null} [ctx.batchState]
 * @param {string|null} [ctx.batchStatePath]
 */
export function runReconciliationCheck(ctx) {
	return reconcileBatch(ctx);
}

/**
 * @param {unknown[]} lanes
 * @param {number|null|undefined} laneNumber
 */
function findLaneForOrphanReconcile(lanes, laneNumber) {
	if (!Array.isArray(lanes)) return null;
	if (laneNumber != null) {
		const match = lanes.find((lane) => Number(lane?.laneNumber) === Number(laneNumber));
		if (match) return match;
	}
	return lanes[0] ?? null;
}

/**
 * Classify tasks for orphan reconcile (status-only, mirrors resume validation).
 *
 * @param {object[]} tasks
 */
function classifyTasksForOrphanReconcile(tasks) {
	return (tasks ?? []).map((task) => {
		const status = String(task?.status ?? "").toLowerCase();
		return {
			taskId: task.taskId,
			laneNumber: task.laneNumber,
			classification: status === "running" ? "running" : status,
		};
	});
}

/**
 * @param {object[]} journalEvents
 * @param {string} taskId
 * @param {string} eventType
 */
function journalHasTaskEvent(journalEvents, taskId, eventType) {
	return journalEvents.some((event) => {
		if (String(event?.type ?? "") !== eventType) return false;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		return eventTaskId === taskId;
	});
}

/**
 * Transition orphan running tasks to failed so retry/resume paths succeed (SP-315 / #20).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @returns {{ reconciled: boolean, taskId?: string|null, kind?: string, exitReason?: string }}
 */
export function reconcileOrphanRunningState({ projectRoot, state }) {
	if (!state || typeof state !== "object") {
		return { reconciled: false };
	}

	const batchId = String(state.batchId ?? "");
	if (!batchId) {
		return { reconciled: false };
	}

	const classifiedTasks = classifyTasksForOrphanReconcile(state.tasks);
	const hasRunningTasks = classifiedTasks.some((task) => task.classification === "running");
	const journalEvents = readJournalEvents(projectRoot, batchId);
	const scopedJournalEvents = journalEventsSinceResume(journalEvents, state);
	const orphanRunning = detectOrphanRunning({
		phase: String(state.phase ?? ""),
		hasRunningTasks,
		tasks: classifiedTasks,
		lanes: state.lanes ?? [],
		raw: state,
		journalEvents: scopedJournalEvents,
	});

	if (!orphanRunning) {
		return { reconciled: false };
	}

	const exitReason = orphanRunning.kind === "engine" ? "engine_orphaned" : "worker_orphaned";
	/** @type {string[]} */
	const taskIdsToFail =
		orphanRunning.kind === "lane" && orphanRunning.taskId
			? [orphanRunning.taskId]
			: classifiedTasks
					.filter((task) => task.classification === "running")
					.map((task) => task.taskId)
					.filter(Boolean);

	if (taskIdsToFail.length === 0) {
		return { reconciled: false };
	}

	const now = Date.now();
	let changed = false;

	for (const taskId of taskIdsToFail) {
		const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
		if (!task || task.status !== "running") continue;

		task.status = "failed";
		task.endedAt = now;
		task.exitReason = exitReason;
		updateSegmentForTask(state, taskId, "failed");
		changed = true;

		if (!journalHasTaskEvent(scopedJournalEvents, taskId, "task.failed")) {
			const lane = findLaneForOrphanReconcile(state.lanes, task.laneNumber);
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: task.laneNumber ?? null,
				laneId: lane?.laneId ?? null,
				reason: exitReason,
				reconciled: true,
			});
		}

		if (
			orphanRunning.kind === "lane" &&
			!journalHasTaskEvent(scopedJournalEvents, taskId, "lane.died")
		) {
			const lane = findLaneForOrphanReconcile(state.lanes, task.laneNumber);
			appendJournalEvent(projectRoot, batchId, "lane.died", {
				taskId,
				laneNumber: task.laneNumber ?? null,
				laneId: lane?.laneId ?? null,
				reason: exitReason,
				reconciled: true,
			});
		}
	}

	for (const lane of state.lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane).workerPid);
		if (Number.isFinite(workerPid) && workerPid > 0 && !isProcessAlive(workerPid)) {
			delete lane.workerPid;
			changed = true;
		}
	}

	const enginePid = readBatchEnginePid(state);
	if (enginePid != null && !isProcessAlive(enginePid)) {
		clearBatchEnginePid(state);
		changed = true;
	}

	if (!changed) {
		return { reconciled: false };
	}

	recomputeTaskCounters(state);
	if (String(state.phase ?? "") === "running") {
		state.phase = "failed";
		state.endedAt = state.endedAt ?? now;
		state.lastError =
			state.lastError ?? `Orphan reconcile: ${exitReason} (task ${taskIdsToFail.join(", ")})`;
	}

	saveSpineBatchState(projectRoot, state);

	return {
		reconciled: true,
		taskId: orphanRunning.taskId ?? taskIdsToFail[0] ?? null,
		kind: orphanRunning.kind,
		exitReason,
	};
}

