// @ts-nocheck
/**
 * Parse Taskplane `.pi/batch-state.json` for dogfood reconciliation.
 */

const TERMINAL_SUCCESS = new Set(["completed", "succeeded", "skipped", "done"]);
const TERMINAL_FAILURE = new Set(["failed", "aborted"]);
const ACTIVE = new Set(["pending", "running", "executing"]);

/**
 * @param {unknown} raw
 * @returns {import("../reconcile.mjs").NormalizedBatchState | null}
 */
export function parseTaskplaneBatchState(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

	/** @type {Record<string, unknown>} */
	const state = /** @type {Record<string, unknown>} */ (raw);
	const batchId = String(state.batchId ?? state.id ?? "").trim();
	if (!batchId) return null;

	const tasks = normalizeTaskplaneTasks(state.tasks);
	const segments = normalizeTaskplaneSegments(state.segments);

	return {
		source: "taskplane",
		batchId,
		phase: String(state.phase ?? state.status ?? "unknown"),
		baseBranch: String(state.baseBranch ?? "main"),
		orchBranch: state.orchBranch ? String(state.orchBranch) : inferOrchBranch(batchId, state),
		startedAt: state.startedAt ?? null,
		endedAt: state.endedAt ?? null,
		failedTasks: Number(state.failedTasks ?? countFailed(tasks)),
		succeededTasks: Number(state.succeededTasks ?? countSucceeded(tasks)),
		totalTasks: Number(state.totalTasks ?? tasks.length),
		mergeResults: Array.isArray(state.mergeResults) ? state.mergeResults : [],
		tasks,
		segments,
		lanes: Array.isArray(state.lanes) ? state.lanes : [],
		raw: state,
	};
}

/**
 * @param {string} batchId
 * @param {Record<string, unknown>} state
 */
function inferOrchBranch(batchId, state) {
	if (state.orchBranch) return String(state.orchBranch);
	const operator = state.operator ? String(state.operator) : "cdelgado";
	return `orch/${operator}-${batchId}`;
}

/**
 * @param {unknown} tasks
 */
function normalizeTaskplaneTasks(tasks) {
	if (!Array.isArray(tasks)) return [];

	return tasks.map((entry) => {
		/** @type {Record<string, unknown>} */
		const task = entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
		const status = normalizeTaskplaneStatus(task.status);
		return {
			taskId: String(task.taskId ?? task.id ?? ""),
			status,
			taskFolder: task.taskFolder ? String(task.taskFolder) : null,
			doneFileFound: Boolean(task.doneFileFound),
			laneNumber: task.laneNumber ?? task.lane ?? null,
			startedAt: task.startedAt ?? null,
			endedAt: task.endedAt ?? null,
			classification: classifyStatus(status),
		};
	});
}

/**
 * @param {unknown} segments
 */
function normalizeTaskplaneSegments(segments) {
	if (!Array.isArray(segments)) return [];

	return segments.map((entry) => {
		/** @type {Record<string, unknown>} */
		const segment =
			entry && typeof entry === "object" ? /** @type {Record<string, unknown>} */ (entry) : {};
		const status = normalizeTaskplaneStatus(segment.status);
		const taskId = String(segment.taskId ?? extractTaskIdFromSegment(segment));
		return {
			segmentId: String(segment.segmentId ?? segment.id ?? `${taskId}::default`),
			taskId,
			status,
			classification: classifyStatus(status),
		};
	});
}

/**
 * @param {Record<string, unknown>} segment
 */
function extractTaskIdFromSegment(segment) {
	const segmentId = String(segment.segmentId ?? segment.id ?? "");
	const match = segmentId.match(/^([A-Z][A-Z0-9]*-\d{3,})/);
	return match?.[1] ?? "";
}

/**
 * @param {unknown} status
 */
function normalizeTaskplaneStatus(status) {
	return String(status ?? "pending").toLowerCase();
}

/**
 * @param {string} status
 */
function classifyStatus(status) {
	const normalized = normalizeTaskplaneStatus(status);
	if (TERMINAL_SUCCESS.has(normalized)) return "terminal-success";
	if (TERMINAL_FAILURE.has(normalized)) return "terminal-failure";
	if (ACTIVE.has(normalized)) return normalized === "running" || normalized === "executing" ? "running" : "pending";
	return "pending";
}

/**
 * @param {Array<{ classification: string }>} tasks
 */
function countFailed(tasks) {
	return tasks.filter((task) => task.classification === "terminal-failure").length;
}

/**
 * @param {Array<{ classification: string }>} tasks
 */
function countSucceeded(tasks) {
	return tasks.filter((task) => task.classification === "terminal-success").length;
}
