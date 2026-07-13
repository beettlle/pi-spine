// @ts-nocheck
/**
 * Pending lane land diagnosis — lane `.DONE` without main land (#201 / SP-645).
 */

/**
 * Tasks with lane `.DONE` but not on main — lane commits never landed (#201 / SP-645).
 *
 * @param {object[]|undefined} tasks
 * @returns {object[]}
 */
export function findPendingLaneLandTasks(tasks) {
	if (!Array.isArray(tasks)) return [];
	return tasks.filter((task) => task?.doneInLane === true && task?.doneOnMain !== true);
}

/**
 * @param {object} signals
 * @returns {boolean}
 */
export function shouldDiagnosePendingLaneLand(signals) {
	const pending = findPendingLaneLandTasks(signals.tasks);
	if (pending.length === 0) return false;
	// Only when orch already appears merged — otherwise healthy pre-integrate
	// waves (doneInLane, awaiting integrate) must stay needs_integrate / settled.
	if (signals.git?.orchMergedToBase !== true) return false;
	if (signals.stateDrift?.drifted === true) return true;
	if (signals.allTasksTerminalSuccess !== true) return false;
	return true;
}

/**
 * @param {string|null|undefined} batchId
 * @param {object[]} pendingTasks
 * @returns {string}
 */
export function buildPendingLaneLandSuggestedCommand(batchId, pendingTasks) {
	const laneNumber = Number(pendingTasks[0]?.laneNumber);
	if (batchId && Number.isFinite(laneNumber) && laneNumber > 0) {
		return `spine batch salvage --batch ${batchId} --lane ${laneNumber} --integrate`;
	}
	if (batchId) {
		return `spine batch salvage --batch ${batchId} --dry-run`;
	}
	return "spine batch salvage --batch <batchId> --dry-run";
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null|undefined} [ctx.batchId]
 * @param {object[]} [ctx.pendingLaneLandTasks]
 * @param {string|null|undefined} [ctx.baseBranch]
 * @returns {string}
 */
export function buildPendingLaneLandHeadline(batchLabel, ctx = {}) {
	const pendingTaskIds = (ctx.pendingLaneLandTasks ?? [])
		.map((task) => String(task.taskId ?? ""))
		.filter(Boolean);
	const baseBranch = ctx.baseBranch ?? "main";
	const taskSuffix = pendingTaskIds.length > 0 ? ` (${pendingTaskIds.join(", ")})` : "";
	return `${batchLabel} has lane work not on ${baseBranch}${taskSuffix} — salvage integrate`;
}
