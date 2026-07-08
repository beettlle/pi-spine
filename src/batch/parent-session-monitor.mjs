// @ts-nocheck
/**
 * Attached engine parent session monitor (FR-STAB-01, GitHub #163, SP-539).
 *
 * Detects parent shell/session loss while an attached batch engine runs and
 * reconciles orphan running tasks before the operator resumes detached.
 */

import { isProcessAlive } from "../process/liveness.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveAttachedMilestonePollMs } from "../config/spine-config-schema.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	clearBatchEnginePid,
	loadSpineBatchState,
	readBatchEnginePid,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parent session is lost when the process reparented or the recorded parent PID died.
 *
 * @param {object} params
 * @param {number} params.initialParentPid
 * @param {number} [params.currentParentPid]
 * @param {(pid: number) => boolean} [params.isAlive]
 */
export function isParentSessionLost({
	initialParentPid,
	currentParentPid = process.ppid,
	isAlive = isProcessAlive,
}) {
	const initial = Number(initialParentPid);
	const current = Number(currentParentPid);
	if (!Number.isFinite(initial) || initial <= 0) {
		return false;
	}
	if (!Number.isFinite(current) || current <= 0) {
		return true;
	}
	if (current !== initial) {
		return true;
	}
	return !isAlive(current);
}

/**
 * Fail-closed reconcile when the attached engine parent session is gone.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {number} params.parentPid
 * @param {number} [params.enginePid]
 * @returns {{ handled: boolean, batchId?: string, taskIds?: string[] }}
 */
export function reconcileParentSessionLost({ projectRoot, parentPid, enginePid = process.pid }) {
	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	if (!state || typeof state !== "object") {
		return { handled: false };
	}

	const batchId = String(state.batchId ?? "");
	if (!batchId) {
		return { handled: false };
	}

	const phase = String(state.phase ?? "");
	if (phase === "completed" || phase === "aborted" || phase === "failed") {
		return { handled: false, batchId };
	}

	appendJournalEvent(projectRoot, batchId, "engine.parent_died", {
		parentPid,
		enginePid,
		signal: "parent_exit",
	});

	const now = Date.now();
	/** @type {string[]} */
	const failedTaskIds = [];
	let changed = false;

	for (const task of state.tasks ?? []) {
		if (!task || typeof task !== "object") continue;
		if (String(task.status ?? "").toLowerCase() !== "running") continue;

		const taskId = String(task.taskId ?? "");
		if (!taskId) continue;

		task.status = "failed";
		task.endedAt = now;
		task.exitReason = "parent_exit";
		updateSegmentForTask(state, taskId, "failed");
		failedTaskIds.push(taskId);
		changed = true;

		const laneNumber = Number(task.laneNumber ?? 1);
		const lane = (state.lanes ?? []).find((entry) => Number(entry?.laneNumber) === laneNumber);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane?.laneId ?? `lane-${laneNumber}`,
			reason: "parent_exit",
			reconciled: true,
		});
	}

	for (const lane of state.lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane).workerPid);
		if (Number.isFinite(workerPid) && workerPid > 0 && !isProcessAlive(workerPid)) {
			delete lane.workerPid;
			changed = true;
		}
	}

	const recordedEnginePid = readBatchEnginePid(state);
	if (recordedEnginePid != null) {
		clearBatchEnginePid(state);
		changed = true;
	}

	if (phase !== "paused") {
		state.phase = "paused";
		changed = true;
	}

	if (!changed) {
		return { handled: true, batchId, taskIds: failedTaskIds };
	}

	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
	return { handled: true, batchId, taskIds: failedTaskIds };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {number} [params.pollIntervalMs]
 * @param {(pid: number) => boolean} [params.isAlive]
 * @param {() => number} [params.readParentPid]
 * @param {(result: ReturnType<typeof reconcileParentSessionLost>) => void} [params.onParentDied]
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function startParentSessionMonitor({
	projectRoot,
	pollIntervalMs,
	isAlive = isProcessAlive,
	readParentPid = () => process.ppid,
	onParentDied,
}) {
	const configResult = loadSpineConfig(projectRoot);
	const resolvedPollMs =
		pollIntervalMs ??
		resolveAttachedMilestonePollMs({ config: configResult.config ?? {} });
	const initialParentPid = readParentPid();
	let stopped = false;
	let handled = false;

	const loop = async () => {
		while (!stopped) {
			if (
				!handled &&
				isParentSessionLost({
					initialParentPid,
					currentParentPid: readParentPid(),
					isAlive,
				})
			) {
				handled = true;
				const result = reconcileParentSessionLost({
					projectRoot,
					parentPid: initialParentPid,
					enginePid: process.pid,
				});
				onParentDied?.(result);
			}
			await sleep(resolvedPollMs);
		}
	};

	const loopPromise = loop();

	return {
		stop: async () => {
			stopped = true;
			await loopPromise;
		},
	};
}
