// @ts-nocheck
/**
 * Running tail-state detection for dashboard + batch headlines (GitHub #68).
 * Browser-safe — no Node or batch-layer imports.
 */

/**
 * @param {object} ctx
 * @returns {boolean}
 */
export function isRunningWithoutActiveWorkers(ctx = {}) {
	if (ctx.hasRunningTasks === true || ctx.hasPendingTasks === true) {
		return false;
	}
	if ((ctx.pendingTaskCount ?? 0) > 0) {
		return false;
	}
	const totalTasks = ctx.totalTasks ?? 0;
	if (totalTasks <= 0) {
		return false;
	}
	const succeededTasks = ctx.succeededTasks ?? 0;
	const failedTasks = ctx.failedTasks ?? 0;
	if (succeededTasks + failedTasks < totalTasks) {
		return false;
	}
	const phase = ctx.phase ?? "";
	if (phase !== "running" && phase !== "merging") {
		return false;
	}
	return true;
}
