// @ts-nocheck
/**
 * Batch lifecycle archive and worktree cleanup helpers (FR-BATCH-15/16).
 */

import fs from "node:fs";
import path from "node:path";
import { appendJournalEvent } from "./journal.mjs";
import {
	clearActiveBatchStateIfMatches,
	loadBatchStateFile,
	readBatchStateId,
} from "./batch-state-io.mjs";
import { removeLaneWorktrees, maxLaneNumberFromBatchState } from "./worktree.mjs";

/**
 * Phases a resume/pause/engine writer can leave behind between a terminal
 * write's pre-lock read and its lock section (SP-792 / #301). When the state
 * re-read inside the lock holds one of these, the batch is active again and
 * the pre-lock dismiss/complete decision no longer holds — fail closed.
 * `executing` is excluded because it is a limbo phase that legitimately
 * allows dismiss (limbo_stale).
 */
const ACTIVE_RESUME_PHASES = new Set(["planning", "running", "paused", "merging"]);

/**
 * Re-read the active batch state inside the terminal lock section
 * (SP-792 / #301) so archive, history, and clear act on the freshest on-disk
 * snapshot instead of the pre-lock read, which goes stale when a concurrent
 * engine save lands between the read and the lock.
 *
 * Fail-closed contract: returns a ready-to-return non-ok `refusal` when the
 * state file vanished, no longer parses, now describes a different batch, or
 * — with `requireTerminalPhase` — the batch became active again mid-write.
 * Abort passes `requireTerminalPhase: false` because aborting a running
 * batch is its normal use case.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null} params.batchStatePath path used by the pre-lock read
 * @param {string} params.batchId batch id the reloaded state must still match
 * @param {"abort"|"dismiss"|"complete"} params.action action name for the refusal headline
 * @param {boolean} [params.requireTerminalPhase] re-validate the terminal-phase precondition on the in-lock state
 * @param {boolean} [params.force] `dismiss --force` skips the phase re-validation
 * @param {string|null} [params.diagnosis] pre-lock diagnosis echoed on refusal
 * @returns {{ state: { path: string, raw: object }|null, refusal: object|null }}
 */
export function reloadStateForTerminalWrite({
	projectRoot,
	batchStatePath,
	batchId,
	action,
	requireTerminalPhase = false,
	force = false,
	diagnosis = null,
}) {
	const refuse = () => ({
		ok: false,
		exitCode: 1,
		error: "batch_state_changed_during_terminal_write",
		headline: `Batch state changed during ${action} — re-run spine status --diagnose`,
		suggestedCommand: "spine status --diagnose",
		diagnosis: diagnosis ?? null,
		batchId,
	});

	const reloaded = loadBatchStateFile(projectRoot, batchStatePath);
	if (!reloaded.path || !reloaded.raw || reloaded.parseError) {
		return { state: null, refusal: refuse() };
	}

	const reloadedBatchId = readBatchStateId(reloaded.raw);
	if (!reloadedBatchId || reloadedBatchId !== batchId) {
		return { state: null, refusal: refuse() };
	}

	if (requireTerminalPhase && !force) {
		const phase = String(/** @type {{ phase?: string }} */ (reloaded.raw).phase ?? "");
		if (ACTIVE_RESUME_PHASES.has(phase)) {
			return { state: null, refusal: refuse() };
		}
	}

	return { state: { path: reloaded.path, raw: reloaded.raw }, refusal: null };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function archiveBatchStatePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "archive", "batch-state.json");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {unknown} raw
 */
export function archiveBatchState(projectRoot, batchId, raw) {
	const archivePath = archiveBatchStatePath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(archivePath), { recursive: true });
	fs.writeFileSync(archivePath, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");

	const fd = fs.openSync(archivePath, "r");
	try {
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}

	return archivePath;
}

/**
 * Clear the completed batch-state pointer under the global batch-state lock
 * (SP-722 / #264; SP-786 / #303). Delegates to `clearActiveBatchStateIfMatches`,
 * which quarantines corrupt state instead of deleting it and refuses to touch
 * Taskplane-owned `.pi/` state files.
 *
 * @param {string} projectRoot
 * @param {string|null} batchStatePath
 * @param {string} batchId
 */
export function clearCompletedBatchState(projectRoot, batchStatePath, batchId) {
	clearActiveBatchStateIfMatches(batchStatePath, batchId, projectRoot);
}

/**
 * @param {object|null|undefined} config
 */
function shouldCleanupWorktreesOnComplete(config) {
	if (config?.lanes?.cleanupWorktreesOnComplete === false) return false;
	return true;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {unknown} params.batchState
 * @param {object} params.config
 */
export function cleanupBatchLaneWorktrees({ projectRoot, batchId, batchState, config }) {
	if (!shouldCleanupWorktreesOnComplete(config)) return;
	const laneCount = maxLaneNumberFromBatchState(batchState);
	removeLaneWorktrees(projectRoot, batchId, laneCount);
	appendJournalEvent(projectRoot, batchId, "batch.worktrees_cleaned", {
		batchId,
		laneCount,
	});
}
