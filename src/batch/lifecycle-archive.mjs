// @ts-nocheck
/**
 * Batch lifecycle archive and worktree cleanup helpers (FR-BATCH-15/16).
 */

import fs from "node:fs";
import path from "node:path";
import { appendJournalEvent } from "./journal.mjs";
import { clearActiveBatchStateIfMatches } from "./batch-state-io.mjs";
import { removeLaneWorktrees, maxLaneNumberFromBatchState } from "./worktree.mjs";

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
