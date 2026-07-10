// @ts-nocheck
/**
 * Batch-state read/write/archive I/O (SP-587 / FR-SHIP-02).
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import {
	clearBatchEnginePid,
	evaluateBatchStateWriteGuard,
	TERMINAL_BATCH_PHASES,
} from "./state-guards.mjs";

export const SPINE_BATCH_STATE_REL = path.join(".spine", "batch-state.json");

export const BATCH_HISTORY_REL = path.join(".spine", "batch-history.json");

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
 * @param {string} batchId
 */
function archivedBatchStatePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "archive", "batch-state.json");
}

/**
 * @param {string} projectRoot
 * @param {object} state
 * @param {{ bypassWriteGuard?: boolean }} [options]
 */
export function saveSpineBatchState(projectRoot, state, options = {}) {
	const guard = options.bypassWriteGuard
		? { allowed: true }
		: evaluateBatchStateWriteGuard(projectRoot, state);
	if (!guard.allowed) {
		const loaded = loadSpineBatchState(projectRoot);
		return loaded.raw ?? state;
	}

	const filePath = spineBatchStatePath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	if (TERMINAL_BATCH_PHASES.has(String(state.phase ?? ""))) {
		clearBatchEnginePid(state);
	}
	const next = { ...state, updatedAt: Date.now() };
	writeJsonAtomic(filePath, next);
	return next;
}

/**
 * @param {string} projectRoot
 */
export function batchHistoryPath(projectRoot) {
	return path.join(projectRoot, BATCH_HISTORY_REL);
}

/**
 * @param {string} projectRoot
 * @param {string|null} [batchId]
 */
export function resolveBatchStateFileForValidation(projectRoot, batchId = null) {
	if (batchId) {
		const archived = archivedBatchStatePath(projectRoot, batchId);
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
