/**
 * Wave merge failure diagnosis helpers (SP-338 / GitHub #29).
 */

/**
 * @param {unknown[]} mergeResults
 * @param {string|null|undefined} lastError
 * @returns {{
 *   mergeFailed: boolean,
 *   failedMerges: number,
 *   failedWaveIndex: number | null,
 *   failedLane: number | null,
 *   lastError: string | null,
 * }}
 */
export function summarizeMergeFailures(mergeResults, lastError = null) {
	const results = Array.isArray(mergeResults) ? mergeResults : [];
	const failedEntries = results.filter(
		(entry) => String(entry?.status ?? "").toLowerCase() === "failed",
	);
	if (failedEntries.length === 0) {
		return {
			mergeFailed: false,
			failedMerges: 0,
			failedWaveIndex: null,
			failedLane: null,
			lastError: lastError ? String(lastError) : null,
		};
	}

	const latestFailed = failedEntries.reduce((latest, entry) => {
		const waveIndex = Number(entry?.waveIndex);
		if (!Number.isFinite(waveIndex)) return latest;
		if (!latest) return entry;
		return Number(latest.waveIndex) > waveIndex ? latest : entry;
	}, null);

	const failedWaveIndex = Number(latestFailed?.waveIndex);
	const failedLaneRaw = latestFailed?.failedLane;
	const failedLane =
		failedLaneRaw == null || failedLaneRaw === ""
			? null
			: Number(failedLaneRaw);
	const resolvedLastError =
		lastError ??
		latestFailed?.failureReason ??
		latestFailed?.error ??
		null;

	return {
		mergeFailed: true,
		failedMerges: failedEntries.length,
		failedWaveIndex: Number.isFinite(failedWaveIndex) ? failedWaveIndex : null,
		failedLane: Number.isFinite(failedLane) ? failedLane : null,
		lastError: resolvedLastError ? String(resolvedLastError) : null,
	};
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {number|null} [ctx.failedWaveIndex]
 * @param {number|null} [ctx.failedLane]
 * @param {string|null} [ctx.lastError]
 * @param {number} [ctx.succeededTasks]
 * @param {number} [ctx.totalTasks]
 */
export function buildMergeFailureHeadline(batchLabel, ctx = {}) {
	const waveNumber =
		ctx.failedWaveIndex == null ? "?" : String(Number(ctx.failedWaveIndex) + 1);
	const laneLabel =
		ctx.failedLane == null ? "unknown lane" : `lane-${ctx.failedLane}`;
	const progress =
		ctx.totalTasks != null && ctx.succeededTasks != null
			? ` (${ctx.succeededTasks}/${ctx.totalTasks} tasks succeeded)`
			: "";
	const errorSuffix = ctx.lastError ? `: ${ctx.lastError}` : "";
	return `${batchLabel} failed: wave ${waveNumber} merge conflict on ${laneLabel}${progress}${errorSuffix}`;
}
