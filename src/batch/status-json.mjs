/**
 * Structured JSON output for `spine status --json` (issue #30, SP-339).
 */

/** @typedef {import("./reconcile.mjs").ReconciliationResult & Record<string, unknown>} StatusJsonInput */

export const STATUS_JSON_PROGRESS_FIELD_NAMES = [
	"succeededTasks",
	"pendingTasks",
	"totalTasks",
	"currentWaveIndex",
	"waveCount",
];

/**
 * Derive monitor-friendly task/wave progress from batch state.
 *
 * @param {object} ctx
 * @param {Record<string, unknown>|null|undefined} ctx.batchRaw
 * @param {number|null|undefined} [ctx.succeededTasks]
 * @param {number|null|undefined} [ctx.totalTasks]
 * @param {number} ctx.pendingTasks
 * @returns {Record<string, number>|null}
 */
export function computeStatusProgress(ctx) {
	const { batchRaw, succeededTasks, totalTasks, pendingTasks } = ctx;
	if (batchRaw == null || typeof batchRaw !== "object") {
		return null;
	}

	const wavePlan = Array.isArray(batchRaw.wavePlan) ? batchRaw.wavePlan : [];
	const currentWaveIndex = Number(batchRaw.currentWaveIndex ?? 0);
	const waveCount = Number(batchRaw.totalWaves ?? wavePlan.length);

	return {
		succeededTasks: Number(succeededTasks ?? batchRaw.succeededTasks ?? 0),
		pendingTasks: Number(pendingTasks),
		totalTasks: Number(totalTasks ?? batchRaw.totalTasks ?? 0),
		currentWaveIndex: Number.isFinite(currentWaveIndex) ? currentWaveIndex : 0,
		waveCount: Number.isFinite(waveCount) ? waveCount : 0,
	};
}

/**
 * Build the JSON-serializable payload for `spine status --json`.
 *
 * @param {StatusJsonInput} reconcileResult
 */
export function buildStatusJson(reconcileResult) {
	return reconcileResult;
}

/**
 * @param {StatusJsonInput} reconcileResult
 */
export function formatStatusJson(reconcileResult) {
	return `${JSON.stringify(buildStatusJson(reconcileResult), null, 2)}\n`;
}
