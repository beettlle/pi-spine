/**
 * Batch-state read/write/archive I/O (SP-587 / FR-SHIP-02).
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { appendJournalEvent } from "./journal.mjs";
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
 * @returns {{ path: string | null, raw: any, parseError: string | null }}
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
 * Make a rejected batch-state write visible instead of silent (#293 / SP-790):
 * journal `batch.state_write_rejected` (when the incoming state carries a batchId)
 * and print one `[spine]` line to stderr so a swallowed late write is diagnosable.
 *
 * @param {string} projectRoot
 * @param {Record<string, any>} state
 * @param {string} reason
 */
function reportRejectedBatchStateWrite(projectRoot, state, reason) {
	const batchId = String(state?.batchId ?? "");
	if (batchId) {
		try {
			appendJournalEvent(projectRoot, batchId, "batch.state_write_rejected", {
				reason,
				incomingPhase: String(state.phase ?? ""),
			});
		} catch {
			/* journal failure must not turn a guarded no-op into a crash */
		}
	}
	console.error(
		`[spine] refused batch-state write (${reason}) for batch ${batchId || "unknown"} — keeping on-disk state`,
	);
}

/**
 * Guard + write path shared by `saveSpineBatchState` and `updateSpineBatchState`
 * (SP-791 / #301). The caller must already hold the batch-state lock; the
 * guard evaluation and the write run in one critical section so the
 * check-then-act pair cannot race a concurrent writer from another process.
 *
 * Returns a structured result so callers can distinguish a rejected write
 * (`{ ok: false, reason }`, disk state returned as `state`) from a persisted
 * one (`{ ok: true, state: next }`).
 *
 * @param {string} projectRoot
 * @param {Record<string, any>} state
 * @param {{ bypassWriteGuard?: boolean, allowArchivedResurrection?: boolean }} options
 * @returns {{ ok: true, state: Record<string, any> } | { ok: false, reason: string, state: Record<string, any> }}
 */
function persistSpineBatchStateGuarded(projectRoot, state, options) {
	const guard = evaluateBatchStateWriteGuard(projectRoot, state, {
		skipOwnerCheck: options.bypassWriteGuard === true,
		allowArchivedResurrection: options.allowArchivedResurrection === true,
	});
	if (!guard.allowed) {
		const reason = String(guard.reason ?? "unknown");
		reportRejectedBatchStateWrite(projectRoot, state, reason);
		const loaded = loadSpineBatchState(projectRoot);
		return { ok: false, reason, state: loaded.raw ?? state };
	}

	const filePath = spineBatchStatePath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	if (TERMINAL_BATCH_PHASES.has(String(state.phase ?? ""))) {
		clearBatchEnginePid(state);
	}
	const next = { ...state, updatedAt: Date.now() };
	writeJsonAtomic(filePath, next);
	return { ok: true, state: next };
}

/**
 * Persist batch state under the global batch-state lock (SP-722 / #264).
 *
 * The guard evaluation and the write run inside one critical section so the
 * check-then-act pair cannot race a concurrent writer from another process
 * (engine vs. CLI complete/resume/abort).
 *
 * `bypassWriteGuard: true` skips only the live-foreign-owner-PID check; the
 * post-archive resurrection check always runs (SP-790 / #293).
 * `allowArchivedResurrection: true` is reserved for operator recovery that
 * intentionally rebuilds an archived batch (force-resume from batch-meta, #126).
 *
 * When the guard rejects, the on-disk state (or the incoming state when no
 * disk state exists) is returned unchanged so existing callers keep their
 * pre-SP-790 contract.
 *
 * @param {string} projectRoot
 * @param {Record<string, any>} state
 * @param {{ bypassWriteGuard?: boolean, allowArchivedResurrection?: boolean }} [options]
 */
export function saveSpineBatchState(projectRoot, state, options = {}) {
	return withBatchStateLock(projectRoot, () =>
		persistSpineBatchStateGuarded(projectRoot, state, options).state,
	);
}

/**
 * Atomic read-modify-write on `.spine/batch-state.json` (SP-791 / #301).
 *
 * Load, clone, mutate, and guarded save all run inside ONE `withBatchStateLock`
 * hold, so racing processes (engine progress save vs. operator pause/resume)
 * each mutate the latest committed state instead of clobbering each other with
 * stale whole-file snapshots. The lock is re-entrant per process, so callers
 * may already hold it (e.g. under `withBatchStateLock`) and the nested
 * acquisition composes instead of self-deadlocking.
 *
 * `mutate(draft, { diskState })` receives a `structuredClone` of the raw disk
 * state plus the disk state itself for read-only reference; mutating `draft`
 * never affects the returned `diskState`. Returning exactly `false` from
 * `mutate` is a no-op: nothing is written and `{ changed: false }` is returned.
 *
 * Results:
 * - `{ ok: false, reason: "missing" }` — no batch-state.json on disk
 * - `{ ok: false, reason: "corrupt" }` — batch-state.json is unparseable
 * - `{ ok: false, reason, state }` — the write guard rejected (e.g.
 *   `stale_engine_pid`, `archived_batch_resurrection`); `state` is the on-disk
 *   state that was kept
 * - `{ ok: true, changed: false, state }` — `mutate` returned `false`;
 *   `state` is the untouched disk state
 * - `{ ok: true, changed: true, state }` — mutated state persisted
 *
 * `options` passes through to the same guard/write path as
 * `saveSpineBatchState` (`bypassWriteGuard` / `allowArchivedResurrection`).
 *
 * @param {string} projectRoot
 * @param {(draft: Record<string, any>, ctx: { diskState: Record<string, any> }) => boolean | unknown} mutate
 * @param {{ bypassWriteGuard?: boolean, allowArchivedResurrection?: boolean }} [options]
 * @returns {{ ok: boolean, reason?: string, changed?: boolean, state?: Record<string, any> }}
 */
export function updateSpineBatchState(projectRoot, mutate, options = {}) {
	const result = /** @type {{ ok: boolean, reason?: string, changed?: boolean, state?: Record<string, any> }} */ (
		withBatchStateLock(projectRoot, () => {
		const loaded = loadSpineBatchState(projectRoot);
		if (!loaded.raw) {
			return { ok: false, reason: loaded.parseError ? "corrupt" : "missing" };
		}
		const diskState = loaded.raw;
		const draft = structuredClone(diskState);
		const mutated = mutate(draft, { diskState });
		if (mutated === false) {
			return { ok: true, changed: false, state: diskState };
		}
		const persisted = persistSpineBatchStateGuarded(projectRoot, draft, options);
		if (!persisted.ok) {
			return { ok: false, reason: persisted.reason, state: persisted.state };
		}
		return { ok: true, changed: true, state: persisted.state };
		})
	);
	return result;
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
