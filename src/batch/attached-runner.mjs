/**
 * Attached / detached resume fast paths for post-merge limbo (SP-348, GitHub #39).
 */

import { finalizeResumedBatchForIntegrate, isPostMergeLimbo } from "./post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "./resume-multi-validate.mjs";
import { terminateStaleDetachedEngine } from "./resume-engine.mjs";
import { saveSpineBatchState } from "./state.mjs";

/**
 * Finalize post-merge limbo during resume without re-running workers.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {string} params.orchBranch
 * @param {string} [params.fromPhase]
 * @param {boolean} [params.resumeForced]
 * @returns {ReturnType<typeof finalizeResumedBatchForIntegrate>|null}
 */
export function finalizeResumePostMergeLimbo({
	projectRoot,
	state,
	batchId,
	orchBranch,
	fromPhase = "running",
	resumeForced = false,
}) {
	if (String(state.phase ?? "") === "completed") {
		return null;
	}
	if (!detectPostMergeLimboForResume({ projectRoot, state }) && !isPostMergeLimbo(state)) {
		return null;
	}

	terminateStaleDetachedEngine({
		projectRoot,
		state,
		batchId,
		fromPhase,
	});
	saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });

	return finalizeResumedBatchForIntegrate({
		projectRoot,
		state,
		batchId,
		orchBranch,
		resumeForced,
	});
}
