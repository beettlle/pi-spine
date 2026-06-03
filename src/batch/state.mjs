/**
 * pi-spine batch-state.json read/write (schema v1, PRD §10.1).
 */

import fs from "node:fs";
import path from "node:path";
import { loadBatchStateFile } from "./reconcile.mjs";

export const SPINE_BATCH_STATE_REL = path.join(".spine", "batch-state.json");

/** @type {ReadonlySet<string>} */
export const ACTIVE_PHASES = new Set(["planning", "running", "paused"]);

/** @type {ReadonlySet<string>} */
export const TERMINAL_BATCH_PHASES = new Set(["completed", "failed", "aborted"]);

/**
 * @returns {string} batchId `{YYYYMMDD}T{HHmmss}` UTC
 */
export function generateBatchId(now = new Date()) {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	const d = String(now.getUTCDate()).padStart(2, "0");
	const h = String(now.getUTCHours()).padStart(2, "0");
	const min = String(now.getUTCMinutes()).padStart(2, "0");
	const s = String(now.getUTCSeconds()).padStart(2, "0");
	return `${y}${m}${d}T${h}${min}${s}`;
}

/**
 * @param {string} projectRoot
 */
export function spineBatchStatePath(projectRoot) {
	return path.join(projectRoot, SPINE_BATCH_STATE_REL);
}

/**
 * @param {string} projectRoot
 */
export function loadSpineBatchState(projectRoot) {
	const filePath = spineBatchStatePath(projectRoot);
	if (!fs.existsSync(filePath)) {
		return { path: null, raw: null, parseError: null };
	}
	try {
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return { path: filePath, raw, parseError: null };
	} catch (err) {
		return {
			path: filePath,
			raw: null,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * @param {string} projectRoot
 * @param {object} state
 */
export function saveSpineBatchState(projectRoot, state) {
	const filePath = spineBatchStatePath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	if (TERMINAL_BATCH_PHASES.has(String(state.phase ?? ""))) {
		clearBatchEnginePid(state);
	}
	const next = { ...state, updatedAt: Date.now() };
	fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
	return next;
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function readBatchEnginePid(raw) {
	if (!raw || typeof raw !== "object") return null;
	/** @type {Record<string, unknown>} */
	const state = /** @type {Record<string, unknown>} */ (raw);
	const resilience =
		state.resilience && typeof state.resilience === "object"
			? /** @type {Record<string, unknown>} */ (state.resilience)
			: null;
	const fromResilience = Number(resilience?.enginePid);
	if (Number.isFinite(fromResilience) && fromResilience > 0) return fromResilience;
	const topLevel = Number(state.enginePid);
	if (Number.isFinite(topLevel) && topLevel > 0) return topLevel;
	return null;
}

/**
 * @param {object} state
 * @param {number} enginePid
 */
export function recordBatchEnginePid(state, enginePid) {
	const pid = Number(enginePid);
	if (!Number.isFinite(pid) || pid <= 0) return;
	state.resilience = state.resilience ?? {};
	state.resilience.enginePid = pid;
	state.resilience.engineStartedAt = Date.now();
}

/**
 * @param {object} state
 */
export function clearBatchEnginePid(state) {
	if (!state?.resilience || typeof state.resilience !== "object") return;
	delete state.resilience.enginePid;
	delete state.resilience.engineStartedAt;
}

/**
 * @param {string} projectRoot
 */
export function assertNoActiveBatch(projectRoot) {
	const spine = loadSpineBatchState(projectRoot);
	if (spine.path && spine.raw) {
		const phase = String(spine.raw.phase ?? "");
		if (ACTIVE_PHASES.has(phase)) {
			throw new Error(
				`Active pi-spine batch ${spine.raw.batchId} (phase=${phase}). Run spine batch dismiss or complete first.`,
			);
		}
	}

	const any = loadBatchStateFile(projectRoot);
	if (any.path && any.raw) {
		const phase = String(any.raw.phase ?? "");
		const active =
			ACTIVE_PHASES.has(phase) || phase === "executing" || phase === "merging" || phase === "stopped";
		if (active && !any.raw.endedAt) {
			throw new Error(
				`Active batch ${any.raw.batchId} at ${any.path} (phase=${phase}). Dismiss or abort before spine batch start.`,
			);
		}
	}
}

/**
 * @param {object} params
 */
export const BATCH_HISTORY_REL = path.join(".spine", "batch-history.json");

/**
 * @param {string} projectRoot
 */
export function batchHistoryPath(projectRoot) {
	return path.join(projectRoot, BATCH_HISTORY_REL);
}

/**
 * @param {unknown} state
 * @returns {{ ok: true } | { ok: false, errors: string[], suggestedCommand: string }}
 */
export function validateBatchState(state) {
	/** @type {string[]} */
	const errors = [];

	if (!state || typeof state !== "object" || Array.isArray(state)) {
		return {
			ok: false,
			errors: ["batch state must be a JSON object"],
			suggestedCommand: "spine state validate --diagnose",
		};
	}

	/** @type {Record<string, unknown>} */
	const raw = /** @type {Record<string, unknown>} */ (state);

	if (raw.schemaVersion !== 1) {
		errors.push(`schemaVersion must be 1 (found ${String(raw.schemaVersion)})`);
	}

	const batchId = String(raw.batchId ?? "").trim();
	if (!batchId) errors.push("batchId is required");

	const phase = String(raw.phase ?? "").trim();
	const validPhases = new Set(["planning", "running", "paused", "completed", "failed", "aborted"]);
	if (!validPhases.has(phase)) {
		errors.push(`phase must be one of ${[...validPhases].join(", ")} (found ${phase || "missing"})`);
	}

	for (const field of ["baseBranch", "orchBranch", "startedAt", "updatedAt", "totalTasks"]) {
		if (raw[field] == null || raw[field] === "") {
			errors.push(`${field} is required`);
		}
	}

	if (!Array.isArray(raw.wavePlan)) errors.push("wavePlan must be an array");
	if (!Array.isArray(raw.tasks)) errors.push("tasks must be an array");
	if (!Array.isArray(raw.lanes)) errors.push("lanes must be an array");
	if (!Array.isArray(raw.mergeResults)) errors.push("mergeResults must be an array");
	if (!Array.isArray(raw.segments)) errors.push("segments must be an array");

	const totalTasks = Number(raw.totalTasks ?? 0);
	const succeededTasks = Number(raw.succeededTasks ?? 0);
	const failedTasks = Number(raw.failedTasks ?? 0);
	const skippedTasks = Number(raw.skippedTasks ?? 0);
	const blockedTasks = Number(raw.blockedTasks ?? 0);
	const taskCount = Array.isArray(raw.tasks) ? raw.tasks.length : 0;

	if (taskCount !== totalTasks) {
		errors.push(`tasks.length (${taskCount}) must match totalTasks (${totalTasks})`);
	}

	const terminalSum = succeededTasks + failedTasks + skippedTasks + blockedTasks;
	if (terminalSum > totalTasks) {
		errors.push(
			`succeeded+failed+skipped+blocked (${terminalSum}) exceeds totalTasks (${totalTasks})`,
		);
	}

	const lanes = Array.isArray(raw.lanes) ? raw.lanes : [];
	const laneNumbers = new Set(
		lanes.map((lane) =>
			lane && typeof lane === "object" ? Number(/** @type {{ laneNumber?: number }} */ (lane).laneNumber) : NaN,
		),
	);

	for (const task of Array.isArray(raw.tasks) ? raw.tasks : []) {
		if (!task || typeof task !== "object") continue;
		const taskId = String(/** @type {{ taskId?: string }} */ (task).taskId ?? "").trim();
		if (!taskId) errors.push("each task must have taskId");

		const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (task).laneNumber);
		if (!Number.isNaN(laneNumber) && laneNumbers.size > 0 && !laneNumbers.has(laneNumber)) {
			errors.push(`task ${taskId} references missing lane ${laneNumber}`);
		}
	}

	for (const lane of lanes) {
		if (!lane || typeof lane !== "object") continue;
		const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (lane).laneNumber);
		const taskIds = Array.isArray(/** @type {{ taskIds?: string[] }} */ (lane).taskIds)
			? /** @type {{ taskIds?: string[] }} */ (lane).taskIds
			: [];
		for (const taskId of taskIds) {
			const found = (raw.tasks ?? []).some(
				(task) =>
					task &&
					typeof task === "object" &&
					String(/** @type {{ taskId?: string }} */ (task).taskId) === taskId &&
					Number(/** @type {{ laneNumber?: number }} */ (task).laneNumber) === laneNumber,
			);
			if (!found) {
				errors.push(`lane ${laneNumber} lists task ${taskId} not assigned to that lane`);
			}
		}
	}

	const segments = Array.isArray(raw.segments) ? raw.segments : [];
	const taskIds = new Set(
		(Array.isArray(raw.tasks) ? raw.tasks : [])
			.map((task) =>
				task && typeof task === "object"
					? String(/** @type {{ taskId?: string }} */ (task).taskId ?? "").trim()
					: "",
			)
			.filter(Boolean),
	);
	const segmentIds = new Set();

	for (const segment of segments) {
		if (!segment || typeof segment !== "object") {
			errors.push("each segment must be an object");
			continue;
		}
		const segmentId = String(/** @type {{ segmentId?: string }} */ (segment).segmentId ?? "").trim();
		const taskId = String(/** @type {{ taskId?: string }} */ (segment).taskId ?? "").trim();
		const status = String(/** @type {{ status?: string }} */ (segment).status ?? "").trim();

		if (!segmentId) errors.push("each segment must have segmentId");
		if (!taskId) errors.push("each segment must have taskId");
		if (!status) errors.push(`segment ${segmentId || "(missing)"} must have status`);
		if (segmentId && segmentIds.has(segmentId)) {
			errors.push(`duplicate segmentId ${segmentId}`);
		}
		if (segmentId) segmentIds.add(segmentId);
		if (taskId && !taskIds.has(taskId)) {
			errors.push(`segment ${segmentId || taskId} references unknown task ${taskId}`);
		}
	}

	for (const taskId of taskIds) {
		const hasSegment = segments.some(
			(segment) =>
				segment &&
				typeof segment === "object" &&
				String(/** @type {{ taskId?: string }} */ (segment).taskId) === taskId,
		);
		if (!hasSegment) {
			errors.push(`task ${taskId} has no matching segment record`);
		}
	}

	if (errors.length > 0) {
		return {
			ok: false,
			errors,
			suggestedCommand: "spine state validate --diagnose",
		};
	}

	return { ok: true };
}

/**
 * @param {string} projectRoot
 * @param {string|null} [batchId]
 */
export function resolveBatchStateFileForValidation(projectRoot, batchId = null) {
	if (batchId) {
		const archived = path.join(
			projectRoot,
			".spine",
			"runtime",
			batchId,
			"archive",
			"batch-state.json",
		);
		if (fs.existsSync(archived)) {
			return { path: archived, source: "archive" };
		}
	}

	const active = spineBatchStatePath(projectRoot);
	if (fs.existsSync(active)) {
		const loaded = loadSpineBatchState(projectRoot);
		if (batchId && loaded.raw && String(loaded.raw.batchId) !== batchId) {
			return { path: null, source: null, error: `Active batch is ${loaded.raw.batchId}, not ${batchId}` };
		}
		return { path: active, source: "active" };
	}

	if (batchId) {
		return { path: null, source: null, error: `No batch-state found for batch ${batchId}` };
	}

	return { path: null, source: null, error: "No active batch-state.json" };
}

/**
 * @param {string} projectRoot
 * @param {object} entry
 */
export function appendBatchHistoryEntry(projectRoot, entry) {
	const filePath = batchHistoryPath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });

	/** @type {object[]} */
	let history = [];
	if (fs.existsSync(filePath)) {
		try {
			const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			if (Array.isArray(parsed)) history = parsed;
		} catch {
			history = [];
		}
	}

	history.push(entry);
	fs.writeFileSync(filePath, `${JSON.stringify(history, null, 2)}\n`, "utf-8");
	return filePath;
}

/**
 * @param {string} taskId
 */
export function defaultSegmentId(taskId) {
	return `${taskId}::default`;
}

/**
 * @param {Array<{ taskId: string }>} tasks
 */
export function buildSegmentsFromTasks(tasks) {
	return tasks.map((task) => ({
		segmentId: defaultSegmentId(task.taskId),
		taskId: task.taskId,
		status: "pending",
		repoId: "default",
	}));
}

/**
 * @param {object} state
 * @param {string} taskId
 * @param {string} status
 */
export function updateSegmentForTask(state, taskId, status) {
	if (!Array.isArray(state.segments)) return;
	for (const segment of state.segments) {
		if (segment && typeof segment === "object" && segment.taskId === taskId) {
			segment.status = status;
		}
	}
}

/**
 * @param {object} state
 * @param {string} [taskId]
 */
export function countPendingSegments(state, taskId = null) {
	const segments = Array.isArray(state.segments) ? state.segments : [];
	return segments.filter((segment) => {
		if (!segment || typeof segment !== "object") return false;
		if (taskId && segment.taskId !== taskId) return false;
		const status = String(segment.status ?? "pending").toLowerCase();
		return status === "pending" || status === "running";
	}).length;
}

/**
 * @param {object} params
 */
export function createInitialBatchState({
	batchId,
	baseBranch,
	orchBranch,
	wavePlan,
	tasks,
	lanes,
}) {
	const now = Date.now();
	return {
		schemaVersion: 1,
		phase: "planning",
		batchId,
		baseBranch,
		orchBranch,
		startedAt: now,
		updatedAt: now,
		endedAt: null,
		currentWaveIndex: 0,
		totalWaves: wavePlan.length,
		wavePlan,
		lanes: lanes.map((lane) => ({ ...lane, lastHeartbeatAt: lane.lastHeartbeatAt ?? null })),
		tasks,
		segments: buildSegmentsFromTasks(tasks),
		mergeResults: [],
		totalTasks: tasks.length,
		succeededTasks: 0,
		failedTasks: 0,
		skippedTasks: 0,
		blockedTasks: 0,
		blockedTaskIds: [],
		lastError: null,
		resilience: {
			resumeForced: false,
			retryCountByScope: {},
			lastFailureClass: null,
			repairHistory: [],
		},
	};
}
