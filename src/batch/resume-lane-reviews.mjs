/**
 * Resume lane review phases — mirror engine-lanes review before lane commit (SP-359).
 */

import { runCodeReviewPhase, runFinalReviewPhase } from "./engine-lanes/review.mjs";

/**
 * @param {object} params
 */
export async function runLaneReviewPhasesBeforeCommit(params) {
	const codeReview = await runCodeReviewPhase(params);
	if (!codeReview.ok) {
		return codeReview;
	}
	return runFinalReviewPhase(params);
}
