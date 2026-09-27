/**
 * Batch state file resolution, load, and parse (leaf module — no reconcile/state imports).
 */

import fs from "node:fs";
import path from "node:path";
import { isProcessAlive } from "../process/liveness.mjs";
import { parseSpineBatchState } from "./readers/spine-state.mjs";
import { parseTaskplaneBatchState } from "./readers/taskplane-state.mjs";
import { withBatchStateLock } from "./batch-state-lock.mjs";

/** Terminal phases safe to clear before a new batch start (SP-441 / #94). */
const TERMINAL_PHASES_FOR_HANDOFF = new Set(["completed", "failed", "aborted", "merge_blocked"]);

/** Phases that block batch start while still active on disk. */
const ACTIVE_PHASES_FOR_HANDOFF = new Set([
	"planning",
	"running",
	"paused",
	"merging",
	"executing",
	"stopped",
]);

/**
 * @param {string} projectRoot
 */
export function resolveBatchStatePath(projectRoot) {
	const spinePath = path.join(projectRoot, ".spine", "batch-state.json");
	if (fs.existsSync(spinePath)) return spinePath;

	const piPath = path.join(projectRoot, ".pi", "batch-state.json");
	if (fs.existsSync(piPath)) return piPath;

	return null;
}

/**
 * @param {string} projectRoot
 * @param {string|null} [batchStatePath]
 */
export function loadBatchStateFile(projectRoot, batchStatePath = null) {
	const resolved = batchStatePath ?? resolveBatchStatePath(projectRoot);
	if (!resolved) return { path: null, raw: null, parseError: null };

	try {
		const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
		return { path: resolved, raw, parseError: null };
	} catch (err) {
		return {
			path: resolved,
			raw: null,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * @param {unknown} raw
 * @param {string} batchStatePath
 */
export function parseBatchState(raw, batchStatePath) {
	if (!raw) return null;
	if (batchStatePath.includes(`${path.sep}.pi${path.sep}`)) {
		return parseTaskplaneBatchState(raw);
	}
	return parseSpineBatchState(raw) ?? parseTaskplaneBatchState(raw);
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function readBatchStateId(raw) {
	if (!raw || typeof raw !== "object") return "";
	/** @type {Record<string, unknown>} */
	const state = /** @type {Record<string, unknown>} */ (raw);
	return String(state.batchId ?? state.id ?? "").trim();
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function readBaseBranchHeadAtStart(raw) {
	if (!raw || typeof raw !== "object") return "";
	return String(/** @type {{ baseBranchHeadAtStart?: string }} */ (raw).baseBranchHeadAtStart ?? "").trim();
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function readIntegrateWorktreePath(raw) {
	if (!raw || typeof raw !== "object") return "";
	return String(/** @type {{ integrateWorktreePath?: string }} */ (raw).integrateWorktreePath ?? "").trim();
}

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function readBatchStateEnginePid(raw) {
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
 * Returns the alive batch-engine PID when complete/archive must wait (FR-STA-22 / #173).
 *
 * @param {unknown} raw
 * @returns {number|null}
 */
export function readAliveBatchEnginePid(raw) {
	const enginePid = readBatchStateEnginePid(raw);
	if (enginePid == null || !isProcessAlive(enginePid)) return null;
	return enginePid;
}

/**
 * Detect a Taskplane-owned batch-state path (`.pi/`) that spine must never
 * modify (SP-786 / #303). Spine start/clear paths act on `.spine/` state only.
 *
 * @param {string} batchStatePath
 */
function isForeignBatchStatePath(batchStatePath) {
	return batchStatePath.includes(`${path.sep}.pi${path.sep}`);
}

/**
 * Rename a corrupt batch-state file to a collision-safe quarantine name in the
 * same directory (SP-786 / #303). Never unlink: the file is evidence for
 * post-mortem inspection. Uses a UTC timestamp plus a numeric suffix when the
 * name is already taken (two corruptions within the same millisecond).
 *
 * @param {string} batchStatePath
 * @returns {string} the quarantined file path
 */
function quarantineCorruptBatchState(batchStatePath) {
	const dir = path.dirname(batchStatePath);
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	let quarantinedPath = path.join(dir, `batch-state.corrupt-${stamp}.json`);
	let attempt = 1;
	while (fs.existsSync(quarantinedPath)) {
		quarantinedPath = path.join(dir, `batch-state.corrupt-${stamp}-${attempt}.json`);
		attempt += 1;
	}
	fs.renameSync(batchStatePath, quarantinedPath);
	return quarantinedPath;
}

/**
 * Remove active batch-state only when on-disk batch matches expected (SP-441 / #94).
 * Prevents complete/dismiss from clearing a newer batch after a concurrent start handoff.
 *
 * Spine-owned path only: a Taskplane-owned `.pi/batch-state.json` is never
 * renamed or unlinked here (SP-786 / #303). A corrupt spine-owned state file
 * is quarantined (renamed), never deleted. The read-check-mutate sequence runs
 * under the global batch-state lock; `projectRoot` may be omitted and is then
 * derived from the `.spine` parent directory of `batchStatePath`.
 *
 * @param {string|null} batchStatePath
 * @param {string} expectedBatchId
 * @param {string} [projectRoot] derived from the `.spine` parent when omitted
 * @returns {{ cleared: boolean, reason?: string, activeBatchId?: string, quarantinedPath?: string }}
 */
export function clearActiveBatchStateIfMatches(batchStatePath, expectedBatchId, projectRoot = null) {
	if (!batchStatePath || !fs.existsSync(batchStatePath)) {
		return { cleared: false, reason: "missing" };
	}
	if (isForeignBatchStatePath(batchStatePath)) {
		return { cleared: false, reason: "foreign_state" };
	}

	// Derive the lock root from `<root>/.spine/batch-state.json` when no caller supplies one.
	const lockRoot = projectRoot ?? path.dirname(path.dirname(batchStatePath));
	return withBatchStateLock(lockRoot, () => {
		try {
			const onDisk = JSON.parse(fs.readFileSync(batchStatePath, "utf-8"));
			const onDiskBatchId = readBatchStateId(onDisk);
			if (onDiskBatchId && onDiskBatchId !== expectedBatchId) {
				return {
					cleared: false,
					reason: "batch_id_mismatch",
					activeBatchId: onDiskBatchId,
				};
			}
		} catch (err) {
			if (/** @type {NodeJS.ErrnoException} */ (err)?.code === "ENOENT") {
				return { cleared: false, reason: "missing" };
			}
			// Corrupt active state — quarantine for inspection, never delete (SP-786 / #303).
			const quarantinedPath = quarantineCorruptBatchState(batchStatePath);
			return { cleared: false, reason: "corrupt", quarantinedPath };
		}

		fs.unlinkSync(batchStatePath);
		return { cleared: true };
	});
}

/**
 * Clear a terminal completed batch-state pointer before spine batch start (SP-441 / #94).
 *
 * Spine-owned path only (SP-786 / #303): when `.spine/batch-state.json` is
 * absent, a Taskplane-owned `.pi/batch-state.json` is reported as
 * `foreign_state` and never renamed or unlinked. A corrupt spine-owned state
 * file is quarantined (renamed), never deleted. The read-check-mutate sequence
 * runs under the global batch-state lock.
 *
 * @param {string} projectRoot
 * @returns {{ cleared: boolean, reason?: string, batchId?: string, quarantinedPath?: string }}
 */
export function clearStaleTerminalBatchStateForStart(projectRoot) {
	const spinePath = path.join(projectRoot, ".spine", "batch-state.json");
	const piPath = path.join(projectRoot, ".pi", "batch-state.json");

	if (!fs.existsSync(spinePath)) {
		if (fs.existsSync(piPath)) {
			return { cleared: false, reason: "foreign_state" };
		}
		return { cleared: false, reason: "missing" };
	}

	return withBatchStateLock(projectRoot, () => {
		/** @type {unknown} */
		let raw;
		try {
			raw = JSON.parse(fs.readFileSync(spinePath, "utf-8"));
		} catch (err) {
			if (/** @type {NodeJS.ErrnoException} */ (err)?.code === "ENOENT") {
				return { cleared: false, reason: "missing" };
			}
			// Corrupt state — quarantine for inspection, never delete (SP-786 / #303).
			const quarantinedPath = quarantineCorruptBatchState(spinePath);
			return { cleared: false, reason: "corrupt", quarantinedPath };
		}

		const batchId = readBatchStateId(raw);
		const phase = String(/** @type {{ phase?: string }} */ (raw)?.phase ?? "");
		const ownerPid = readBatchStateEnginePid(raw);

		if (ACTIVE_PHASES_FOR_HANDOFF.has(phase) && !/** @type {{ endedAt?: unknown }} */ (raw)?.endedAt) {
			return { cleared: false, reason: "active", batchId };
		}

		if (ownerPid && isProcessAlive(ownerPid)) {
			throw new Error(
				`Active batch ${batchId || "(unknown)"} engine still running (pid=${ownerPid}). ` +
					"Wait for it to exit or run spine batch dismiss before spine batch start.",
			);
		}

		if (TERMINAL_PHASES_FOR_HANDOFF.has(phase) || /** @type {{ endedAt?: unknown }} */ (raw)?.endedAt) {
			fs.unlinkSync(spinePath);
			return { cleared: true, reason: "stale_terminal", batchId };
		}

		return { cleared: false, reason: "idle", batchId };
	});
}
