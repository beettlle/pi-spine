import { appendJournalEvent } from "./journal.mjs";

/**
 * Journal merged paths the sync skipped (uncommitted operator edits), then return the
 * operator-facing warning string; null when there is no overlap (SP-784 / #298).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {string} params.mergeCommit
 * @param {string[]} [params.skippedDirtyPaths]
 * @param {number|null} [params.laneNumber] Salvage-only lane number added to the journal event.
 * @returns {string | null}
 */
export function reportDirtyOverlap({
	projectRoot,
	batchId,
	baseBranch,
	orchBranch,
	mergeCommit,
	skippedDirtyPaths = [],
	laneNumber = null,
}) {
	if (skippedDirtyPaths.length === 0) return null;
	appendJournalEvent(projectRoot, batchId, "integrate.dirty_overlap", {
		baseBranch,
		orchBranch,
		mergeCommit,
		...(laneNumber != null ? { laneNumber } : {}),
		skippedDirtyPaths,
	});
	return `DirtyOverlap: ${skippedDirtyPaths.join(", ")} kept local edits — run git diff / git restore --source ${baseBranch} -- ${skippedDirtyPaths.join(" ")} after review`;
}
