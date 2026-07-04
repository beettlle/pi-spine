/**
 * Batch state file resolution, load, and parse (leaf module — no reconcile/state imports).
 */

import fs from "node:fs";
import path from "node:path";
import { isProcessAlive } from "../process/liveness.mjs";
import { parseSpineBatchState } from "./readers/spine-state.mjs";
import { parseTaskplaneBatchState } from "./readers/taskplane-state.mjs";

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
 * Remove active batch-state only when on-disk batch matches expected (SP-441 / #94).
 * Prevents complete/dismiss from clearing a newer batch after a concurrent start handoff.
 *
 * @param {string|null} batchStatePath
 * @param {string} expectedBatchId
 * @returns {{ cleared: boolean, reason?: string, activeBatchId?: string }}
 */
export function clearActiveBatchStateIfMatches(batchStatePath, expectedBatchId) {
	if (!batchStatePath || !fs.existsSync(batchStatePath)) {
		return { cleared: false, reason: "missing" };
	}

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
	} catch {
		// Corrupt active state — remove so a new batch can start cleanly.
	}

	fs.unlinkSync(batchStatePath);
	return { cleared: true };
}

/**
 * Clear a terminal completed batch-state pointer before spine batch start (SP-441 / #94).
 *
 * @param {string} projectRoot
 * @returns {{ cleared: boolean, reason?: string, batchId?: string }}
 */
export function clearStaleTerminalBatchStateForStart(projectRoot) {
	const resolved = resolveBatchStatePath(projectRoot);
	if (!resolved || !fs.existsSync(resolved)) {
		return { cleared: false, reason: "missing" };
	}

	/** @type {unknown} */
	let raw;
	try {
		raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
	} catch {
		fs.unlinkSync(resolved);
		return { cleared: true, reason: "corrupt" };
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
		fs.unlinkSync(resolved);
		return { cleared: true, reason: "stale_terminal", batchId };
	}

	return { cleared: false, reason: "idle", batchId };
}
