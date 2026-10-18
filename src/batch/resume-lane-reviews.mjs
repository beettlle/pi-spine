/**
 * Resume lane review phases — mirror engine-lanes review before lane commit (SP-359).
 * Engine-owned plan review runs first for RL≥1 (SP-695 / #250).
 * Resumed reviews use the same per-task effective reviewer config as a fresh run (SP-834 / #355).
 */

import { runCodeReviewPhase, runFinalReviewPhase, runPlanReviewPhase } from "./engine-lanes/review.mjs";
import { applyTaskReviewProfile } from "./engine-lanes/task-agent-profile.mjs";

/**
 * @param {Record<string, any>} params
 */
export async function runLaneReviewPhasesBeforeCommit(params) {
	const reviewProfile = await applyTaskReviewProfile(params);
	if (!reviewProfile.ok) return reviewProfile;
	const reviewParams = { ...params, config: reviewProfile.config };
	const planReview = await runPlanReviewPhase(reviewParams);
	if (!planReview.ok) return planReview;
	const codeReview = await runCodeReviewPhase(reviewParams);
	if (!codeReview.ok) return codeReview;
	return runFinalReviewPhase(reviewParams);
}
