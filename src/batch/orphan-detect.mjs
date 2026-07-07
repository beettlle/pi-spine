// @ts-nocheck
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
 * @param {unknown} event
 * @returns {string|null}
 */
function eventFromPhase(event) {
	if (!event || typeof event !== "object") return null;
	const payload = /** @type {{ fromPhase?: unknown, payload?: { fromPhase?: unknown } }} */ (event);
	const direct = payload.fromPhase ?? payload.payload?.fromPhase;
	return typeof direct === "string" && direct ? direct : null;
}

/**
 * Paused batch resumed with --force after intentional engine handoff (SP-513 / #184).
 *
 * @param {object[]} journalEvents
 */
export function journalIndicatesPausedForceResume(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;
	return journalEvents.some((event) => {
		if (String(event?.type ?? "") !== "batch.resumed") return false;
		const payload =
			event.payload && typeof event.payload === "object"
				? /** @type {Record<string, unknown>} */ (event.payload)
				: {};
		const resumeForced = payload.resumeForced === true || event.resumeForced === true;
		const fromPhase = eventFromPhase(event);
		return resumeForced && fromPhase === "paused";
	});
}

/**
 * @param {object[]} journalEvents
 * @param {string} taskId
 */
export function journalHasContractVerified(journalEvents, taskId) {
	if (!Array.isArray(journalEvents) || !taskId) return false;
	return journalEvents.some((event) => {
		if (String(event?.type ?? "") !== "contract.verified") return false;
		const matchedTaskId = eventTaskId(event) ?? event.payload?.taskId;
		if (matchedTaskId !== taskId) return false;
		const payload =
			event.payload && typeof event.payload === "object"
				? /** @type {Record<string, unknown>} */ (event.payload)
				: {};
		if (payload.ok === false || event.ok === false) return false;
		return true;
	});
}

/**
 * Running cache tasks with lane `.DONE` and contract verify should not surface engine_orphaned
 * after a paused force-resume handoff (SP-513 / #184).
 *
 * @param {object} ctx
 * @param {object[]} scopedJournalEvents
 */
export function shouldSuppressPausedResumeEngineOrphan(ctx, scopedJournalEvents) {
	if (!journalIndicatesPausedForceResume(scopedJournalEvents)) {
		return false;
	}

	const cacheTasks = Array.isArray(ctx.raw?.tasks) ? ctx.raw.tasks : [];
	const runningCacheTasks = cacheTasks.filter(
		(task) => String(task?.status ?? "").toLowerCase() === "running",
	);
	if (runningCacheTasks.length === 0) {
		return false;
	}

	const classifiedById = new Map(
		(ctx.tasks ?? [])
			.filter((task) => typeof task?.taskId === "string" && task.taskId)
			.map((task) => [task.taskId, task]),
	);
	const journalEvents = Array.isArray(ctx.fullJournalEvents)
		? ctx.fullJournalEvents
		: scopedJournalEvents;

	for (const task of runningCacheTasks) {
		const taskId = String(task.taskId ?? "");
		if (!taskId) return false;
		const classified = classifiedById.get(taskId);
		if (classified?.doneInLane !== true) {
			return false;
		}
		if (!journalHasContractVerified(journalEvents, taskId)) {
			return false;
		}
	}

	return true;
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
 * @param {unknown} event
 * @returns {string|null}
 */
function eventTaskId(event) {
	if (!event || typeof event !== "object") return null;
	const direct = /** @type {{ taskId?: unknown }} */ (event).taskId;
	if (typeof direct === "string" && direct) return direct;
	const payload = /** @type {{ payload?: { taskId?: unknown } }} */ (event).payload;
	const nested = payload?.taskId;
	return typeof nested === "string" && nested ? nested : null;
}

/**
 * @param {unknown} event
 * @returns {number|null}
 */
function eventLaneNumber(event) {
	if (!event || typeof event !== "object") return null;
	const direct = /** @type {{ laneNumber?: unknown, payload?: { laneNumber?: unknown } }} */ (
		event
	).laneNumber;
	if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
	const payload = /** @type {{ payload?: { laneNumber?: unknown } }} */ (event).payload?.laneNumber;
	return payload != null && Number.isFinite(Number(payload)) ? Number(payload) : null;
}

/**
 * Running task is inside task.started → first lane.heartbeat debounce (SP-345 / #36).
 * Stale workerPid from a prior lane handoff must not trigger worker_orphaned mid-start.
 *
 * @param {object[]} journalEvents
 * @param {string} taskId
 * @param {number|null|undefined} laneNumber
 */
export function journalTaskAwaitingFirstHeartbeat(journalEvents, taskId, laneNumber) {
	if (!Array.isArray(journalEvents) || !taskId) return false;

	let lastStartedIndex = -1;
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (String(event?.type ?? "") !== "task.started") continue;
		if (eventTaskId(event) !== taskId) continue;
		if (laneNumber != null) {
			const eventLane = eventLaneNumber(event);
			if (eventLane != null && eventLane !== Number(laneNumber)) continue;
		}
		lastStartedIndex = index;
		break;
	}

	if (lastStartedIndex < 0) return false;

	for (let index = lastStartedIndex + 1; index < journalEvents.length; index += 1) {
		const event = journalEvents[index];
		if (String(event?.type ?? "") !== "lane.heartbeat") continue;
		if (eventTaskId(event) === taskId) return false;
	}

	return true;
}

/**
 * Worker exited (post-done grace or natural exit) but engine still owns code/final review.
 *
 * @param {object[]} journalEvents
 * @param {string} taskId
 */
export function journalIndicatesEngineOwnedContinuation(journalEvents, taskId) {
	if (!Array.isArray(journalEvents) || !taskId) return false;
	return journalEvents.some(
		(event) =>
			String(event?.taskId ?? "") === taskId &&
			String(event?.type ?? "") === "lane.completed",
	);
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

	const scopedJournalEvents = journalEventsSinceResume(ctx.journalEvents ?? [], ctx.raw);

	for (const task of runningTasks) {
		const lane = findLane(ctx.lanes, task.laneNumber);
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane)?.workerPid);
		if (Number.isFinite(workerPid) && workerPid > 0 && !isProcessAlive(workerPid)) {
			if (journalIndicatesEngineOwnedContinuation(scopedJournalEvents, task.taskId)) {
				continue;
			}
			if (
				journalTaskAwaitingFirstHeartbeat(
					scopedJournalEvents,
					task.taskId,
					task.laneNumber,
				)
			) {
				const enginePid = readBatchEnginePid(ctx.raw);
				if (enginePid != null && isProcessAlive(enginePid)) {
					continue;
				}
			}
			/** @type {OrphanRunningSignal} */
			return {
				kind: "lane",
				taskId: task.taskId,
				workerPid,
			};
		}
	}

	const enginePid = readBatchEnginePid(ctx.raw);
	const suppressPausedResumeEngineOrphan = shouldSuppressPausedResumeEngineOrphan(
		ctx,
		scopedJournalEvents,
	);
	if (
		enginePid &&
		!isProcessAlive(enginePid) &&
		!journalHasTerminalBatchEvent(scopedJournalEvents) &&
		!suppressPausedResumeEngineOrphan
	) {
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
		journalIndicatesStalledSession(scopedJournalEvents) &&
		!suppressPausedResumeEngineOrphan
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
