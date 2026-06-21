/**
 * Per-lane throughput stats derivation (Phase 42 — task-based, not token-based).
 *
 * Derives active elapsed time, terminal task counts, and tasks/hour from batch-state
 * lanes plus journal events, optionally refined by run-metrics task records.
 */

const MS_PER_HOUR = 3_600_000;

/**
 * @typedef {object} LaneThroughputStats
 * @property {number} activeElapsedMs
 * @property {number} completedCount
 * @property {number} failedCount
 * @property {number} throughputTasksPerHour
 */

/**
 * @returns {LaneThroughputStats}
 */
export function emptyLaneThroughputStats() {
	return {
		activeElapsedMs: 0,
		completedCount: 0,
		failedCount: 0,
		throughputTasksPerHour: 0,
	};
}

/**
 * @param {number} laneNumber
 * @param {object} event
 */
function laneEventMatches(laneNumber, event) {
	const laneId = `lane-${laneNumber}`;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (payload.laneNumber != null && Number(payload.laneNumber) !== laneNumber) return false;
	if (event.laneId && event.laneId !== laneId) return false;
	return true;
}

/**
 * @param {object} event
 * @returns {string|null}
 */
function journalEventTaskId(event) {
	if (typeof event.taskId === "string" && event.taskId) return event.taskId;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	return typeof payload.taskId === "string" ? payload.taskId : null;
}

/**
 * @param {object} event
 * @returns {number|null}
 */
function journalEventTimestampMs(event) {
	if (event.timestamp == null) return null;
	const ts =
		typeof event.timestamp === "number"
			? event.timestamp
			: Date.parse(String(event.timestamp));
	return Number.isNaN(ts) ? null : ts;
}

/**
 * @param {number} completedCount
 * @param {number} activeElapsedMs
 * @returns {number}
 */
export function computeThroughputTasksPerHour(completedCount, activeElapsedMs) {
	if (completedCount <= 0 || activeElapsedMs <= 0) return 0;
	return (completedCount * MS_PER_HOUR) / activeElapsedMs;
}

/**
 * @param {unknown[]} tasks
 * @returns {Map<string, number>}
 */
function buildTaskLaneIndex(tasks) {
	/** @type {Map<string, number>} */
	const index = new Map();
	for (const task of tasks ?? []) {
		if (!task || typeof task !== "object") continue;
		const taskId = /** @type {{ taskId?: string }} */ (task).taskId;
		const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (task).laneNumber);
		if (!taskId || !Number.isFinite(laneNumber) || laneNumber <= 0) continue;
		index.set(String(taskId), laneNumber);
	}
	return index;
}

/**
 * @param {object} params
 * @param {number} params.laneNumber
 * @param {Set<string>} params.laneTaskIds
 * @param {Map<string, number>} params.taskLaneById
 * @param {object} event
 */
function eventBelongsToLane({ laneNumber, laneTaskIds, taskLaneById }, event) {
	if (laneEventMatches(laneNumber, event)) return true;
	const taskId = journalEventTaskId(event);
	if (!taskId) return false;
	if (laneTaskIds.has(taskId)) return true;
	return taskLaneById.get(taskId) === laneNumber;
}

/**
 * @param {object} params
 * @param {number} params.laneNumber
 * @param {object[]} params.journalEvents
 * @param {Set<string>} params.laneTaskIds
 * @param {Map<string, number>} params.taskLaneById
 * @param {number} params.now
 */
function deriveCountsAndJournalElapsed({
	laneNumber,
	journalEvents,
	laneTaskIds,
	taskLaneById,
	now,
}) {
	let completedCount = 0;
	let failedCount = 0;
	let activeElapsedMs = 0;

	/** @type {Map<string, number>} */
	const openStartedAt = new Map();

	for (const event of journalEvents ?? []) {
		if (!eventBelongsToLane({ laneNumber, laneTaskIds, taskLaneById }, event)) continue;

		const taskId = journalEventTaskId(event);
		const timestampMs = journalEventTimestampMs(event);
		if (timestampMs == null) continue;

		if (event.type === "task.started" && taskId) {
			openStartedAt.set(taskId, timestampMs);
			continue;
		}

		if (event.type === "task.completed") {
			completedCount += 1;
			if (taskId && openStartedAt.has(taskId)) {
				activeElapsedMs += Math.max(0, timestampMs - openStartedAt.get(taskId));
				openStartedAt.delete(taskId);
			}
			continue;
		}

		if (event.type === "task.failed") {
			failedCount += 1;
			if (taskId && openStartedAt.has(taskId)) {
				activeElapsedMs += Math.max(0, timestampMs - openStartedAt.get(taskId));
				openStartedAt.delete(taskId);
			}
		}
	}

	for (const startedAt of openStartedAt.values()) {
		activeElapsedMs += Math.max(0, now - startedAt);
	}

	return { completedCount, failedCount, activeElapsedMs };
}

/**
 * @param {object[]} metricsLines
 * @param {number} laneNumber
 * @returns {{ elapsedMs: number, hasRecords: boolean }}
 */
function sumMetricsElapsedForLane(metricsLines, laneNumber) {
	let elapsedMs = 0;
	let hasRecords = false;

	for (const line of metricsLines ?? []) {
		if (!line || typeof line !== "object") continue;
		if (line.recordType !== "task") continue;
		if (Number(line.laneNumber) !== laneNumber) continue;
		hasRecords = true;
		if (Number.isFinite(line.durationMs)) {
			elapsedMs += Math.max(0, Number(line.durationMs));
		}
	}

	return { elapsedMs, hasRecords };
}

/**
 * @param {object} params
 * @param {object} params.lane
 * @param {object[]} [params.journalEvents]
 * @param {object[]} [params.metricsLines]
 * @param {unknown[]} [params.tasks]
 * @param {number} [params.now]
 * @returns {LaneThroughputStats}
 */
export function deriveLaneThroughputStats({
	lane,
	journalEvents = [],
	metricsLines = [],
	tasks = [],
	now = Date.now(),
}) {
	if (!lane || typeof lane !== "object") return emptyLaneThroughputStats();

	const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (lane).laneNumber);
	if (!Number.isFinite(laneNumber) || laneNumber <= 0) return emptyLaneThroughputStats();

	const laneTaskIds = new Set(
		(Array.isArray(/** @type {{ taskIds?: string[] }} */ (lane).taskIds)
			? /** @type {{ taskIds?: string[] }} */ (lane).taskIds
			: []
		).map(String),
	);
	const taskLaneById = buildTaskLaneIndex(tasks);

	const journalDerived = deriveCountsAndJournalElapsed({
		laneNumber,
		journalEvents,
		laneTaskIds,
		taskLaneById,
		now,
	});

	const metricsDerived = sumMetricsElapsedForLane(metricsLines, laneNumber);
	const activeElapsedMs = metricsDerived.hasRecords
		? metricsDerived.elapsedMs
		: journalDerived.activeElapsedMs;

	return {
		activeElapsedMs,
		completedCount: journalDerived.completedCount,
		failedCount: journalDerived.failedCount,
		throughputTasksPerHour: computeThroughputTasksPerHour(
			journalDerived.completedCount,
			activeElapsedMs,
		),
	};
}

/**
 * @param {object} params
 * @param {object[]} [params.lanes]
 * @param {object[]} [params.journalEvents]
 * @param {object[]} [params.metricsLines]
 * @param {unknown[]} [params.tasks]
 * @param {number} [params.now]
 * @returns {Map<number, LaneThroughputStats>}
 */
export function deriveLanesThroughput({
	lanes = [],
	journalEvents = [],
	metricsLines = [],
	tasks = [],
	now = Date.now(),
}) {
	/** @type {Map<number, LaneThroughputStats>} */
	const statsByLane = new Map();

	for (const lane of lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (lane).laneNumber);
		if (!Number.isFinite(laneNumber) || laneNumber <= 0) continue;
		statsByLane.set(
			laneNumber,
			deriveLaneThroughputStats({
				lane,
				journalEvents,
				metricsLines,
				tasks,
				now,
			}),
		);
	}

	return statsByLane;
}
