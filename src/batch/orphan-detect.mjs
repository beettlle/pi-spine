/**
 * Orphan running batch detection (SP-082, FR-BATCH-12 extension).
 */

import { isProcessAlive } from "../process/liveness.mjs";
import { readBatchEnginePid } from "./state.mjs";

/** @type {ReadonlySet<string>} */
export const TERMINAL_JOURNAL_TYPES = new Set([
	"batch.completed",
	"batch.failed",
	"batch.aborted",
	"task.failed",
	"lane.died",
	"lane.stall_killed",
]);

/**
 * @param {object[]} events
 */
export function journalHasTerminalBatchEvent(events) {
	if (!Array.isArray(events) || events.length === 0) return false;
	return events.some((event) => TERMINAL_JOURNAL_TYPES.has(String(event?.type ?? "")));
}

/**
 * @param {unknown[]} lanes
 * @param {number|null|undefined} laneNumber
 */
function findLane(lanes, laneNumber) {
	if (!Array.isArray(lanes)) return null;
	if (laneNumber != null) {
		const match = lanes.find((lane) => Number(lane?.laneNumber) === Number(laneNumber));
		if (match) return match;
	}
	return lanes[0] ?? null;
}

/**
 * @typedef {object} OrphanRunningSignal
 * @property {"lane"|"engine"} kind
 * @property {string|null} taskId
 * @property {number|null} [workerPid]
 * @property {number|null} [enginePid]
 */

/**
 * @param {object} ctx
 * @param {string} ctx.phase
 * @param {boolean} ctx.hasRunningTasks
 * @param {Array<{ taskId: string, classification: string, laneNumber?: number|null }>} ctx.tasks
 * @param {unknown[]} ctx.lanes
 * @param {Record<string, unknown>|null|undefined} ctx.raw
 * @param {object[]} [ctx.journalEvents]
 */
export function detectOrphanRunning(ctx) {
	const runningTasks = (ctx.tasks ?? []).filter((task) => task.classification === "running");
	if (ctx.phase !== "running" && !ctx.hasRunningTasks && runningTasks.length === 0) {
		return null;
	}

	for (const task of runningTasks) {
		const lane = findLane(ctx.lanes, task.laneNumber);
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane)?.workerPid);
		if (Number.isFinite(workerPid) && workerPid > 0 && !isProcessAlive(workerPid)) {
			/** @type {OrphanRunningSignal} */
			return {
				kind: "lane",
				taskId: task.taskId,
				workerPid,
			};
		}
	}

	const enginePid = readBatchEnginePid(ctx.raw);
	if (enginePid && !isProcessAlive(enginePid) && !journalHasTerminalBatchEvent(ctx.journalEvents ?? [])) {
		/** @type {OrphanRunningSignal} */
		return {
			kind: "engine",
			taskId: runningTasks[0]?.taskId ?? null,
			enginePid,
		};
	}

	return null;
}
