// @ts-nocheck
/**
 * Force-resume gate reopen for completed batches (SP-740 / #275).
 * Extracted from resume.mjs to keep that module under the 500 LOC cap.
 */

import { reopenIntegrateGateForCompletedBatch } from "./gate.mjs";
import { updateSpineBatchState } from "./state.mjs";

/**
 * When `resumeCheck.gateReopen` is set, re-open the integrate gate and return
 * a resumeBatch-shaped result. Caller must release the resume lock via the
 * returned path (this helper releases it).
 *
 * The reopen decision and the state persist run in one `updateSpineBatchState`
 * critical section (SP-793 / #301): the phase is re-read under the lock from the
 * latest committed state instead of a stale pre-load, and the persist goes
 * through the write guard with no owner bypass — a completed batch has no live
 * engine owner, so a guard rejection here is a real signal, not an obstacle.
 *
 * @param {{
 *   projectRoot: string,
 *   resumeCheck: { batchId: string, gateReopen?: boolean },
 *   releaseResumeLock?: (() => void) | null,
 * }} params
 * @returns {object | null} resumeBatch result when handled; null when not a reopen path
 */
export function tryResumeCompletedGateReopen({ projectRoot, resumeCheck, releaseResumeLock }) {
	if (!resumeCheck?.gateReopen) {
		return null;
	}

	let reopenResult = null;
	updateSpineBatchState(projectRoot, (draft) => {
		reopenResult = reopenIntegrateGateForCompletedBatch({
			projectRoot,
			batchId: resumeCheck.batchId,
			batchState: draft,
		});
		// The gate record is written by the reopen itself; persisting the draft
		// keeps parity with the prior unconditional save (refreshes updatedAt).
		return true;
	});
	if (!reopenResult) {
		// Missing or corrupt batch-state on disk: evaluate reopen without state
		// so the CLI reports the same batch_not_completed result as before.
		reopenResult = reopenIntegrateGateForCompletedBatch({
			projectRoot,
			batchId: resumeCheck.batchId,
		});
	}
	releaseResumeLock?.();
	const output = reopenResult.reopened
		? `Batch ${resumeCheck.batchId} gate re-opened: evidence re-collected, targetRevision re-pinned.\n  → spine gate approve\n  → spine integrate\n`
		: `${reopenResult.headline}\n  → ${reopenResult.suggestedCommand}\n`;
	return {
		ok: reopenResult.ok,
		exitCode: reopenResult.exitCode,
		batchId: resumeCheck.batchId,
		reopened: reopenResult.reopened,
		reopenReason: reopenResult.reason,
		gate: reopenResult.gate,
		error: reopenResult.error,
		output,
	};
}
