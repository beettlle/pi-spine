// @ts-nocheck
/**
 * Single-batch resume validation wrapper (extracted from resume.mjs for LOC policy).
 */

import { validateMultiTaskResume } from "./resume-multi.mjs";

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 */
export function validateResumeBatch({ projectRoot, force = false }) {
	const result = validateMultiTaskResume({ projectRoot, force });
	if (!result.ok) {
		return result;
	}

	const taskId = result.pendingTasks.length === 1 ? result.pendingTasks[0].taskId : undefined;

	return {
		...result,
		taskId,
	};
}
