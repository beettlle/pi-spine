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

/** Session-start events in the scoped post-resume window (SP-095, SP-111). */
/** @type {ReadonlySet<string>} */
export const SESSION_START_JOURNAL_TYPES = new Set(["batch.resumed", "task.started"]);

/**
 * @param {object[]} events
 */
export function journalHasTerminalBatchEvent(events) {
	if (!Array.isArray(events) || events.length === 0) return false;
	return events.some((event) => TERMINAL_JOURNAL_TYPES.has(String(event?.type ?? "")));
}

/**
 * Scoped journal shows a resumed/started session with no terminal closure (SP-111).
 *
 * @param {object[]} events
 */
export function journalIndicatesStalledSession(events) {
	if (!Array.isArray(events) || events.length === 0) return false;
	if (journalHasTerminalBatchEvent(events)) return false;
	return events.some((event) => SESSION_START_JOURNAL_TYPES.has(String(event?.type ?? "")));
}

/**
 * @param {unknown} event
 * @returns {number|null}
 */
function eventTimestampMs(event) {
	if (!event || typeof event !== "object") return null;
	const ts = /** @type {{ timestamp?: unknown }} */ (event).timestamp;
	if (typeof ts === "number" && Number.isFinite(ts)) return ts;
	if (typeof ts === "string") {
		const parsed = Date.parse(ts);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {number|null}
 */
function readEngineStartedAt(raw) {
	if (!raw || typeof raw !== "object") return null;
	const resilience = /** @type {Record<string, unknown>} */ (raw).resilience;
	if (!resilience || typeof resilience !== "object") return null;
	const startedAt = Number(/** @type {Record<string, unknown>} */ (resilience).engineStartedAt);
	return Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null;
}

/**
 * Journal events for the current detached engine session only.
 * Prefers the latest `batch.resumed`; otherwise filters from `engineStartedAt`.
 *
 * @param {object[]} events
 * @param {Record<string, unknown>|null|undefined} [raw]
 */
export function journalEventsSinceResume(events, raw) {
	if (!Array.isArray(events) || events.length === 0) return [];

	let resumeIndex = -1;
	for (let i = events.length - 1; i >= 0; i--) {
		if (String(events[i]?.type ?? "") === "batch.resumed") {
			resumeIndex = i;
			break;
		}
	}
	if (resumeIndex >= 0) {
		return events.slice(resumeIndex);
	}

	const engineStartedAt = readEngineStartedAt(raw);
	if (engineStartedAt != null) {
		return events.filter((event) => {
			const ts = eventTimestampMs(event);
			return ts == null || ts >= engineStartedAt;
		});
	}

	return events;
}

/**
 * @param {unknown[]} lanes
 * @param {Array<{ laneNumber?: number|null }>} runningTasks
 */
function hasFiniteWorkerPidForRunningTasks(lanes, runningTasks) {
	for (const task of runningTasks) {
		const lane = findLane(lanes, task.laneNumber);
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane)?.workerPid);
		if (Number.isFinite(workerPid) && workerPid > 0) return true;
	}
	return false;
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
	const scopedJournalEvents = journalEventsSinceResume(ctx.journalEvents ?? [], ctx.raw);
	if (enginePid && !isProcessAlive(enginePid) && !journalHasTerminalBatchEvent(scopedJournalEvents)) {
		/** @type {OrphanRunningSignal} */
		return {
			kind: "engine",
			taskId: runningTasks[0]?.taskId ?? null,
			enginePid,
		};
	}

	const engineStartedAt = readEngineStartedAt(ctx.raw);
	if (
		ctx.phase === "running" &&
		runningTasks.length > 0 &&
		enginePid == null &&
		!hasFiniteWorkerPidForRunningTasks(ctx.lanes, runningTasks) &&
		engineStartedAt != null &&
		journalIndicatesStalledSession(scopedJournalEvents)
	) {
		/** @type {OrphanRunningSignal} */
		return {
			kind: "engine",
			taskId: runningTasks[0]?.taskId ?? null,
			enginePid: null,
		};
	}

	return null;
}
