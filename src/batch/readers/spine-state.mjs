/**
 * Parse pi-spine batch-state.json (schema v1, tolerant reader).
 */

const TERMINAL_SUCCESS = new Set(["completed", "succeeded", "skipped"]);
const TERMINAL_FAILURE = new Set(["failed", "aborted"]);
const ACTIVE = new Set(["pending", "running"]);

/**
 * @param {unknown} raw
 * @returns {import("../reconcile.mjs").NormalizedBatchState | null}
 */
export function parseSpineBatchState(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

	/** @type {Record<string, unknown>} */
	const state = /** @type {Record<string, unknown>} */ (raw);
	const batchId = String(state.batchId ?? state.id ?? "").trim();
	if (!batchId) return null;

	const tasks = normalizeTasks(state.tasks);
	const segments = normalizeSegments(state.segments);

	return {
		source: "spine",
		batchId,
		phase: String(state.phase ?? state.status ?? "unknown"),
		baseBranch: String(state.baseBranch ?? "main"),
		orchBranch: state.orchBranch ? String(state.orchBranch) : null,
		startedAt: state.startedAt ?? null,
		endedAt: state.endedAt ?? null,
		failedTasks: Number(state.failedTasks ?? 0),
		succeededTasks: Number(state.succeededTasks ?? 0),
		totalTasks: Number(state.totalTasks ?? tasks.length),
		mergeResults: Array.isArray(state.mergeResults) ? state.mergeResults : [],
		tasks,
		segments,
		lanes: Array.isArray(state.lanes) ? state.lanes : [],
		raw: state,
	};
}

/**
 * @param {unknown} tasks
 */
function normalizeTasks(tasks) {
	if (!Array.isArray(tasks)) return [];

	return tasks.map((entry) => {
		/** @type {Record<string, unknown>} */
		const task = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
		const status = String(task.status ?? "pending").toLowerCase();
		return {
			taskId: String(task.taskId ?? task.id ?? ""),
			status,
			taskFolder: task.taskFolder ? String(task.taskFolder) : null,
			doneFileFound: Boolean(task.doneFileFound),
			laneNumber: task.laneNumber ?? null,
			startedAt: task.startedAt ?? null,
			endedAt: task.endedAt ?? null,
			classification: classifyStatus(status),
		};
	});
}

/**
 * @param {unknown} segments
 */
function normalizeSegments(segments) {
	if (!Array.isArray(segments)) return [];

	return segments.map((entry) => {
		/** @type {Record<string, unknown>} */
		const segment =
			entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
		const status = String(segment.status ?? "pending").toLowerCase();
		return {
			segmentId: String(segment.segmentId ?? segment.id ?? ""),
			taskId: String(segment.taskId ?? ""),
			status,
			classification: classifyStatus(status),
		};
	});
}

/**
 * @param {string} status
 */
function classifyStatus(status) {
	const normalized = String(status ?? "pending").toLowerCase();
	if (TERMINAL_SUCCESS.has(normalized)) return "terminal-success";
	if (TERMINAL_FAILURE.has(normalized)) return "terminal-failure";
	if (ACTIVE.has(normalized)) return normalized === "running" ? "running" : "pending";
	return "pending";
}
