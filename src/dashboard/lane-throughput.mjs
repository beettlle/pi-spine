/**
 * Per-lane throughput stats from batch-state lanes, journal, and run-metrics (SP-326).
 * Task-based counts and rates — not LLM token metrics.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * @param {object} event
 * @returns {number|null}
 */
export function eventLaneNumber(event) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (payload.laneNumber != null) {
		const laneNumber = Number(payload.laneNumber);
		if (Number.isFinite(laneNumber) && laneNumber > 0) return laneNumber;
	}
	if (event.laneNumber != null) {
		const laneNumber = Number(event.laneNumber);
		if (Number.isFinite(laneNumber) && laneNumber > 0) return laneNumber;
	}
	if (typeof event.laneId === "string") {
		const match = /^lane-(\d+)$/.exec(event.laneId);
		if (match) return Number(match[1]);
	}
	return null;
}

/**
 * @param {object} event
 * @returns {number|null}
 */
export function eventTimestampMs(event) {
	if (typeof event.timestamp === "number") return event.timestamp;
	if (typeof event.timestamp === "string") {
		const parsed = Date.parse(event.timestamp);
		return Number.isNaN(parsed) ? null : parsed;
	}
	return null;
}

/**
 * @param {object} event
 * @returns {string|null}
 */
function eventTaskId(event) {
	if (typeof event.taskId === "string" && event.taskId) return event.taskId;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	return typeof payload.taskId === "string" ? payload.taskId : null;
}

/**
 * @returns {{ activeElapsedMs: number, completedCount: number, failedCount: number, throughputTasksPerHour: number|null }}
 */
export function emptyLaneThroughputStats() {
	return {
		activeElapsedMs: 0,
		completedCount: 0,
		failedCount: 0,
		throughputTasksPerHour: null,
	};
}

/**
 * @param {number} completedCount
 * @param {number} activeElapsedMs
 * @returns {number|null}
 */
export function computeThroughputTasksPerHour(completedCount, activeElapsedMs) {
	if (completedCount <= 0 || activeElapsedMs <= 0) return null;
	return (completedCount * MS_PER_HOUR) / activeElapsedMs;
}

/**
 * @param {object[]} metricsLines
 * @returns {Map<string, { durationMs: number, laneNumber: number|null }>}
 */
function buildMetricsByTaskId(metricsLines) {
	/** @type {Map<string, { durationMs: number, laneNumber: number|null }>} */
	const byTaskId = new Map();
	for (const line of metricsLines ?? []) {
		if (line.recordType !== "task") continue;
		if (typeof line.taskId !== "string" || !line.taskId) continue;
		const durationMs = Number(line.durationMs);
		const laneNumber = Number.isFinite(line.laneNumber) ? Number(line.laneNumber) : null;
		byTaskId.set(line.taskId, {
			durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
			laneNumber,
		});
	}
	return byTaskId;
}

/**
 * @param {object} params
 * @param {object[]} params.lanes
 * @param {object[]} [params.journalEvents]
 * @param {object[]} [params.metricsLines]
 * @param {number} [params.now]
 * @returns {Map<number, ReturnType<typeof emptyLaneThroughputStats>>}
 */
export function deriveLaneThroughputStats({
	lanes = [],
	journalEvents = [],
	metricsLines = [],
	now = Date.now(),
}) {
	/** @type {Map<number, ReturnType<typeof emptyLaneThroughputStats>>} */
	const statsByLane = new Map();
	for (const lane of lanes ?? []) {
		const laneNumber = Number(lane?.laneNumber);
		if (!Number.isFinite(laneNumber) || laneNumber <= 0) continue;
		statsByLane.set(laneNumber, emptyLaneThroughputStats());
	}

	const metricsByTaskId = buildMetricsByTaskId(metricsLines);
	/** @type {Map<string, { laneNumber: number, startedAtMs: number }>} */
	const openTasks = new Map();

	for (const event of journalEvents ?? []) {
		const laneNumber = eventLaneNumber(event);
		const taskId = eventTaskId(event);
		const eventMs = eventTimestampMs(event);

		if (event.type === "task.started") {
			if (!taskId || laneNumber == null) continue;
			openTasks.set(taskId, { laneNumber, startedAtMs: eventMs ?? now });
			continue;
		}

		if (
			event.type !== "task.completed" &&
			event.type !== "task.failed" &&
			event.type !== "task.skipped_done_on_disk"
		) {
			continue;
		}

		if (!taskId) continue;

		const open = openTasks.get(taskId);
		const resolvedLaneNumber = laneNumber ?? open?.laneNumber;
		if (resolvedLaneNumber == null) continue;

		if (!statsByLane.has(resolvedLaneNumber)) {
			statsByLane.set(resolvedLaneNumber, emptyLaneThroughputStats());
		}

		const stats = statsByLane.get(resolvedLaneNumber);
		const metric = metricsByTaskId.get(taskId);
		const startedAtMs = open?.startedAtMs ?? eventMs ?? now;
		const endedAtMs = eventMs ?? now;
		const durationMs =
			metric && metric.durationMs > 0
				? metric.durationMs
				: Math.max(0, endedAtMs - startedAtMs);

		stats.activeElapsedMs += durationMs;
		if (event.type === "task.failed") {
			stats.failedCount += 1;
		} else {
			stats.completedCount += 1;
		}
		openTasks.delete(taskId);
	}

	for (const [taskId, open] of openTasks) {
		if (!statsByLane.has(open.laneNumber)) continue;
		const stats = statsByLane.get(open.laneNumber);
		const metric = metricsByTaskId.get(taskId);
		const durationMs =
			metric && metric.durationMs > 0
				? metric.durationMs
				: Math.max(0, now - open.startedAtMs);
		stats.activeElapsedMs += durationMs;
	}

	for (const stats of statsByLane.values()) {
		stats.throughputTasksPerHour = computeThroughputTasksPerHour(
			stats.completedCount,
			stats.activeElapsedMs,
		);
	}

	return statsByLane;
}

/**
 * @param {number|null|undefined} activeElapsedMs
 */
export function formatElapsedMs(activeElapsedMs) {
	if (activeElapsedMs == null || !Number.isFinite(activeElapsedMs) || activeElapsedMs <= 0) {
		return "—";
	}
	const totalSeconds = Math.floor(activeElapsedMs / 1000);
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const totalMinutes = Math.floor(totalSeconds / 60);
	if (totalMinutes < 60) return `${totalMinutes}m`;
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}

/**
 * @param {number|null|undefined} throughputTasksPerHour
 */
export function formatThroughputRate(throughputTasksPerHour) {
	if (throughputTasksPerHour == null || !Number.isFinite(throughputTasksPerHour)) {
		return "—";
	}
	if (throughputTasksPerHour >= 10) return `${Math.round(throughputTasksPerHour)}`;
	return throughputTasksPerHour.toFixed(1);
}

/**
 * @param {Map<number, ReturnType<typeof emptyLaneThroughputStats>>} statsByLane
 */
export function summarizeLaneThroughput(statsByLane) {
	let activeElapsedMs = 0;
	let completedCount = 0;
	let failedCount = 0;

	for (const stats of statsByLane.values()) {
		activeElapsedMs += stats.activeElapsedMs;
		completedCount += stats.completedCount;
		failedCount += stats.failedCount;
	}

	return {
		activeElapsedMs,
		completedCount,
		failedCount,
		throughputTasksPerHour: computeThroughputTasksPerHour(completedCount, activeElapsedMs),
	};
}
