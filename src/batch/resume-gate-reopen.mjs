// @ts-nocheck
/**
 * Force-resume gate reopen for completed batches (SP-740 / #275).
 * Extracted from resume.mjs to keep that module under the 500 LOC cap.
 */

import { reopenIntegrateGateForCompletedBatch } from "./gate.mjs";
import { loadSpineBatchState, saveSpineBatchState } from "./state.mjs";

/**
 * When `resumeCheck.gateReopen` is set, re-open the integrate gate and return
 * a resumeBatch-shaped result. Caller must release the resume lock via the
 * returned path (this helper releases it).
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

	const reopenState = loadSpineBatchState(projectRoot).raw;
	const reopenResult = reopenIntegrateGateForCompletedBatch({
		projectRoot,
		batchId: resumeCheck.batchId,
		batchState: reopenState,
	});
	if (reopenState) {
		saveSpineBatchState(projectRoot, reopenState, { bypassWriteGuard: true });
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
