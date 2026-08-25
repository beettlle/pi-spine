// @ts-nocheck
/**
 * Batch-state read/write/archive I/O (SP-587 / FR-SHIP-02).
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { withBatchStateLock } from "./batch-state-lock.mjs";
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
 * Persist batch state under the global batch-state lock (SP-722 / #264).
 *
 * The guard evaluation and the write run inside one critical section so the
 * check-then-act pair cannot race a concurrent writer from another process
 * (engine vs. CLI complete/resume/abort).
 *
 * @param {string} projectRoot
 * @param {object} state
 * @param {{ bypassWriteGuard?: boolean }} [options]
 */
export function saveSpineBatchState(projectRoot, state, options = {}) {
	return withBatchStateLock(projectRoot, () => {
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
	});
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
 * Quarantine a corrupt batch-history file instead of silently resetting it to
 * `[]`. The audit trail is operator-facing state: losing it silently hides
 * evidence of what batches ran, so the original bytes are preserved under
 * `.spine/runtime/` and a loud error is emitted (#261).
 *
 * @param {string} projectRoot
 * @param {string} filePath
 * @param {string} reason
 * @returns {string|null} quarantine path, or null if quarantine failed
 */
function quarantineCorruptBatchHistory(projectRoot, filePath, reason) {
	const quarantineDir = path.join(projectRoot, ".spine", "runtime");
	const quarantinePath = path.join(quarantineDir, `batch-history.json.corrupt.${Date.now()}`);
	try {
		fs.mkdirSync(quarantineDir, { recursive: true });
		try {
			fs.renameSync(filePath, quarantinePath);
		} catch {
			// Fall back to copy+unlink when rename is unsupported (e.g. cross-device).
			fs.copyFileSync(filePath, quarantinePath);
			fs.unlinkSync(filePath);
		}
	} catch (err) {
		console.error(
			`[spine] batch-history.json is corrupt (${reason}) and quarantine failed: ${
				err instanceof Error ? err.message : String(err)
			}. Refusing to overwrite the corrupt file.`,
		);
		return null;
	}
	console.error(
		`[spine] batch-history.json is corrupt (${reason}); quarantined to ${path.relative(
			projectRoot,
			quarantinePath,
		)}. Starting a fresh history — inspect the quarantined file to recover prior entries.`,
	);
	return quarantinePath;
}

/**
 * Append an entry to `.spine/batch-history.json` atomically under the
 * global batch-state lock (SP-722 / #264).
 *
 * The write goes through `writeJsonAtomic` (temp file + rename) so a crash or
 * concurrent reader never observes a truncated history (#261). A corrupt
 * existing file is quarantined, never silently reset to `[]`. The full
 * read-modify-write runs under the same lock as batch-state writes so
 * concurrent processes cannot lose history entries.
 *
 * @param {string} projectRoot
 * @param {object} entry
 */
export function appendBatchHistoryEntry(projectRoot, entry) {
	return withBatchStateLock(projectRoot, () => {
		const filePath = batchHistoryPath(projectRoot);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });

		/** @type {object[]} */
		let history = [];
		if (fs.existsSync(filePath)) {
			try {
				const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
				if (Array.isArray(parsed)) {
					history = parsed;
				} else {
					if (quarantineCorruptBatchHistory(projectRoot, filePath, "root value is not an array") === null) {
						throw new Error(`Refusing to append batch history: ${filePath} is corrupt and could not be quarantined`);
					}
				}
			} catch (err) {
				if (err instanceof SyntaxError) {
					if (quarantineCorruptBatchHistory(projectRoot, filePath, err.message) === null) {
						throw new Error(`Refusing to append batch history: ${filePath} is corrupt and could not be quarantined`);
					}
				} else {
					throw err;
				}
			}
		}

		history.push(entry);
		writeJsonAtomic(filePath, history);
		return filePath;
	});
}
