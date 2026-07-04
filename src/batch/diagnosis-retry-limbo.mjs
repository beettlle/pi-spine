/**
 * Failed-phase limbo after retry clears failed tasks but phase stays failed (GitHub #25).
 */

/**
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 * @param {number} [ctx.failedTasks]
 * @param {number} [ctx.pendingTaskCount]
 * @param {string|null} [ctx.phase]
 */
export function isFailedPhasePendingOnlyLimbo(ctx = {}) {
	return (
		String(ctx.phase ?? "") === "failed" &&
		(ctx.failedTasks ?? 0) === 0 &&
		(ctx.pendingTaskCount ?? 0) > 0 &&
		!ctx.failedTaskId
	);
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 */
export function buildFailedPhasePendingOnlyHeadline(batchLabel, _ctx = {}) {
	return `${batchLabel} failed with pending task(s) and no failed tasks — resume to continue`;
}

/**
 * @param {object} ctx
 */
export function buildFailedPhasePendingOnlySuggestedCommand(_ctx = {}) {
	return "spine batch resume --force";
}
