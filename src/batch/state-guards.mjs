// @ts-nocheck
/**
 * Batch-state write guards, engine PID tracking, and schema validation (SP-587 / FR-SHIP-02).
 */

import fs from "node:fs";
import path from "node:path";
import { isProcessAlive } from "../process/liveness.mjs";

/** @type {ReadonlySet<string>} */
export const ACTIVE_PHASES = new Set(["planning", "running", "paused"]);

/** @type {ReadonlySet<string>} */
export const TERMINAL_BATCH_PHASES = new Set([
	"completed",
	"failed",
	"aborted",
	"merge_blocked",
]);

const SPINE_BATCH_STATE_REL = path.join(".spine", "batch-state.json");

/**
 * @param {string} projectRoot
 */
function spineBatchStatePath(projectRoot) {
	return path.join(projectRoot, SPINE_BATCH_STATE_REL);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function archivedBatchStatePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "archive", "batch-state.json");
}

/**
 * Reject cache writes from non-owner engines or post-archive resurrection (SP-254).
 *
 * @param {string} projectRoot
 * @param {object} state
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function evaluateBatchStateWriteGuard(projectRoot, state) {
	const filePath = spineBatchStatePath(projectRoot);
	const batchId = String(state.batchId ?? "");
	const incomingPhase = String(state.phase ?? "");

	if (fs.existsSync(filePath)) {
		try {
			const onDisk = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			const onDiskBatchId = String(onDisk.batchId ?? "");
			const incomingBatchId = String(state.batchId ?? "");
			const onDiskPhase = String(onDisk.phase ?? "");
			const ownerPid = readBatchEnginePid(onDisk);
			if (
				incomingBatchId &&
				onDiskBatchId &&
				incomingBatchId !== onDiskBatchId &&
				TERMINAL_BATCH_PHASES.has(onDiskPhase) &&
				(!ownerPid || !isProcessAlive(ownerPid))
			) {
				return { allowed: true };
			}
			if (ownerPid && ownerPid !== process.pid && isProcessAlive(ownerPid)) {
				return { allowed: false, reason: "stale_engine_pid" };
			}
		} catch {
			/* corrupt on-disk state — allow overwrite */
		}
	} else if (batchId && ACTIVE_PHASES.has(incomingPhase)) {
		if (fs.existsSync(archivedBatchStatePath(projectRoot, batchId))) {
			return { allowed: false, reason: "archived_batch_resurrection" };
		}
	}

	return { allowed: true };
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
	const validPhases = new Set([
		"planning",
		"running",
		"paused",
		"merging",
		"completed",
		"failed",
		"aborted",
		"merge_blocked",
	]);
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
