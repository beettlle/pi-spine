/**
 * Rebuild batch task/segment status from append-only journal (FR-REL-01/02, PRD §11.4).
 */

import { readJournalEvents } from "./journal.mjs";
import {
	clearTaskFailureMetadata,
	recomputeTaskCounters,
	updateSegmentForTask,
} from "./state.mjs";

/** @type {ReadonlySet<string>} */
export const TASK_LIFECYCLE_EVENT_TYPES = new Set([
	"task.started",
	"task.completed",
	"task.failed",
	"task.skipped",
	"task.skipped_done_on_disk",
	"task.retry_requested",
	"task.prompt_parse_failed",
]);

/** @type {ReadonlySet<string>} */
export const BATCH_PHASE_EVENT_TYPES = new Set([
	"batch.paused",
	"batch.completed",
	"batch.failed",
	"batch.aborted",
	"batch.dismissed",
]);

/**
 * @param {object[]} events
 * @returns {object[]}
 */
export function readJournalTimeline(events) {
	return events.filter(
		(event) =>
			TASK_LIFECYCLE_EVENT_TYPES.has(String(event?.type ?? "")) ||
			BATCH_PHASE_EVENT_TYPES.has(String(event?.type ?? "")),
	);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {object[]}
 */
export function readJournalTimelineFromDisk(projectRoot, batchId) {
	return readJournalTimeline(readJournalEvents(projectRoot, batchId));
}

/**
 * @param {object} state
 * @param {object} event
 */
function applyJournalEvent(state, event) {
	const type = String(event?.type ?? "");
	const taskId = typeof event.taskId === "string" ? event.taskId : null;
	const payload =
		event.payload && typeof event.payload === "object" ? event.payload : {};
	const timestamp = Date.parse(String(event.timestamp ?? "")) || Date.now();

	if (!taskId && !BATCH_PHASE_EVENT_TYPES.has(type)) return;

	const task = taskId
		? (state.tasks ?? []).find((entry) => entry?.taskId === taskId)
		: null;

	switch (type) {
		case "task.started": {
			if (!task) return;
			task.status = "running";
			task.startedAt = Number(payload.startedAt) || timestamp;
			task.endedAt = null;
			clearTaskFailureMetadata(task);
			updateSegmentForTask(state, taskId, "running");
			break;
		}
		case "task.completed": {
			if (!task) return;
			task.status = "succeeded";
			task.endedAt = Number(payload.endedAt) || timestamp;
			task.doneFileFound = payload.doneFileFound !== false;
			task.exitReason = String(payload.exitReason ?? "done");
			if ("classification" in task) delete task.classification;
			updateSegmentForTask(state, taskId, "succeeded");
			break;
		}
		case "task.failed":
		case "task.prompt_parse_failed": {
			if (!task) return;
			task.status = "failed";
			task.endedAt = Number(payload.endedAt) || timestamp;
			task.doneFileFound = false;
			task.exitReason = String(payload.exitReason ?? payload.reason ?? type);
			if (payload.classification) {
				task.classification = String(payload.classification);
			}
			updateSegmentForTask(state, taskId, "failed");
			break;
		}
		case "task.skipped":
		case "task.skipped_done_on_disk": {
			if (!task) return;
			task.status = "skipped";
			task.endedAt = Number(payload.endedAt) || timestamp;
			task.doneFileFound = type === "task.skipped_done_on_disk";
			task.exitReason = String(payload.exitReason ?? "skipped");
			updateSegmentForTask(state, taskId, "skipped");
			break;
		}
		case "task.retry_requested": {
			if (!task) return;
			clearTaskFailureMetadata(task);
			task.status = "pending";
			task.startedAt = null;
			task.endedAt = null;
			task.doneFileFound = false;
			updateSegmentForTask(state, taskId, "pending");
			break;
		}
		case "batch.paused":
			state.phase = "paused";
			break;
		case "batch.completed":
			state.phase = "completed";
			state.endedAt = Number(payload.endedAt) || timestamp;
			break;
		case "batch.failed":
			state.phase = "failed";
			state.endedAt = Number(payload.endedAt) || timestamp;
			break;
		case "batch.aborted":
		case "batch.dismissed":
			state.phase = "aborted";
			state.endedAt = Number(payload.endedAt) || timestamp;
			break;
		default:
			break;
	}
}

/**
 * Apply journal timeline to a copy of batch-state (structural fields preserved from seed).
 *
 * @param {object} seedState
 * @param {object[]} events
 * @returns {object}
 */
export function rebuildBatchStateFromJournal(seedState, events) {
	const timeline = readJournalTimeline(events);
	const rebuilt = structuredClone(seedState);

	for (const event of timeline) {
		applyJournalEvent(rebuilt, event);
	}

	recomputeTaskCounters(rebuilt);
	return rebuilt;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} seedState
 * @returns {object}
 */
export function rebuildBatchStateFromDisk(projectRoot, batchId, seedState) {
	const events = readJournalEvents(projectRoot, batchId);
	return rebuildBatchStateFromJournal(seedState, events);
}

/**
 * @typedef {{ taskId: string, field: string, cached: unknown, rebuilt: unknown }} DriftEntry
 */

/**
 * @param {object[]} events
 * @param {string} taskId
 * @returns {object|null}
 */
function lastLifecycleEventForTask(events, taskId) {
	const taskEvents = events.filter(
		(event) =>
			event?.taskId === taskId &&
			TASK_LIFECYCLE_EVENT_TYPES.has(String(event?.type ?? "")),
	);
	return taskEvents.length > 0 ? taskEvents[taskEvents.length - 1] : null;
}

/**
 * Compare cached batch-state vs journal rebuild — only flag when journal
 * authoritatively contradicts cache (e.g. task.completed in journal, failed in cache).
 * Incomplete journals (task.started only, cache failed) are not drift.
 *
 * @param {object} cachedState
 * @param {object} rebuiltState
 * @param {object[]} [events]
 * @returns {{ drifted: boolean, entries: DriftEntry[] }}
 */
export function detectBatchStateDrift(cachedState, rebuiltState, events = []) {
	/** @type {DriftEntry[]} */
	const entries = [];
	const rebuiltById = new Map(
		(rebuiltState?.tasks ?? []).map((task) => [String(task?.taskId), task]),
	);

	for (const cached of cachedState?.tasks ?? []) {
		if (!cached?.taskId) continue;
		const taskId = String(cached.taskId);
		const rebuilt = rebuiltById.get(taskId);
		if (!rebuilt) continue;

		const lastEvent = lastLifecycleEventForTask(events, taskId);
		if (!lastEvent) continue;

		const lastType = String(lastEvent.type ?? "");

		if (lastType === "task.completed" && cached.status !== "succeeded") {
			entries.push({
				taskId,
				field: "status",
				cached: cached.status,
				rebuilt: rebuilt.status,
			});
			continue;
		}

		if (
			lastType === "task.retry_requested" &&
			cached.status === "failed" &&
			rebuilt.status === "pending"
		) {
			entries.push({
				taskId,
				field: "status",
				cached: cached.status,
				rebuilt: rebuilt.status,
			});
			continue;
		}

		if (lastType === "task.started" && cached.status === "failed") {
			continue;
		}

		if (
			(lastType === "task.failed" || lastType === "task.prompt_parse_failed") &&
			cached.status === rebuilt.status
		) {
			continue;
		}
	}

	return { drifted: entries.length > 0, entries };
}
