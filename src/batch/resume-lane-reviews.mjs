/**
 * Resume lane review phases — mirror engine-lanes review before lane commit (SP-359).
 * Engine-owned plan review runs first for RL≥1 (SP-695 / #250).
 */

import { runCodeReviewPhase, runFinalReviewPhase, runPlanReviewPhase } from "./engine-lanes/review.mjs";

/**
 * @param {object} params
 */
export async function runLaneReviewPhasesBeforeCommit(params) {
	const planReview = await runPlanReviewPhase(params);
	if (!planReview.ok) {
		return planReview;
	}
	const codeReview = await runCodeReviewPhase(params);
	if (!codeReview.ok) {
		return codeReview;
	}
	return runFinalReviewPhase(params);
}
