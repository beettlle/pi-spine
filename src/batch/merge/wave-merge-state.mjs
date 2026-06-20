/**
 * Wave merge bookkeeping — detect waves missing mergeResults entries.
 */

/**
 * @param {object} state
 * @returns {Set<number>}
 */
export function succeededWaveMergeIndices(state) {
	const mergeResults = state.mergeResults ?? [];
	return new Set(
		mergeResults
			.filter((entry) => String(entry?.status ?? "").toLowerCase() === "succeeded")
			.map((entry) => Number(entry.waveIndex))
			.filter((waveIndex) => Number.isFinite(waveIndex)),
	);
}

/**
 * @param {object} state
 * @param {number} waveIndex
 */
export function waveTasksAllTerminal(state, waveIndex) {
	const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
	const tasks = state.tasks ?? [];
	if (waveTaskIds.length === 0) {
		return false;
	}
	return waveTaskIds.every((taskId) => {
		const task = tasks.find((entry) => entry?.taskId === taskId);
		if (!task) return false;
		const status = String(task.status ?? "").toLowerCase();
		return status === "succeeded" || status === "skipped";
	});
}

/**
 * First wave index whose tasks are terminal but lacks a succeeded mergeResults row.
 *
 * @param {object} state
 * @returns {number | null}
 */
export function findFirstWaveNeedingMerge(state) {
	const succeeded = succeededWaveMergeIndices(state);
	const wavePlan = state.wavePlan ?? [];
	for (let waveIndex = 0; waveIndex < wavePlan.length; waveIndex++) {
		if (succeeded.has(waveIndex)) {
			continue;
		}
		if (waveTasksAllTerminal(state, waveIndex)) {
			return waveIndex;
		}
	}
	return null;
}

/**
 * @param {object} state
 */
export function hasPendingWaveMerge(state) {
	return findFirstWaveNeedingMerge(state) != null;
}

/**
 * @param {object} state
 * @param {number} waveIndex
 */
export function isWaveForceMerged(state, waveIndex) {
	return (state.resilience?.forceMergedWaves ?? []).includes(waveIndex);
}

/**
 * @param {object} params
 * @param {object} params.state
 * @param {number} params.waveIndex
 * @param {"succeeded" | "failed"} params.status
 * @param {string | null} [params.mergeCommit]
 * @param {number | null} [params.failedLane]
 * @param {string | null} [params.failureReason]
 * @param {string | null} [params.failureClass]
 */
export function recordWaveMergeResult({
	state,
	waveIndex,
	status,
	mergeCommit = null,
	failedLane = null,
	failureReason = null,
	failureClass = null,
}) {
	state.mergeResults = state.mergeResults ?? [];
	const existingIndex = state.mergeResults.findIndex((entry) => entry?.waveIndex === waveIndex);
	const row = {
		waveIndex,
		status,
		forceMerged: isWaveForceMerged(state, waveIndex),
		failedLane,
		failureReason,
		failureClass,
		mergeCommit,
	};
	if (existingIndex >= 0) {
		state.mergeResults[existingIndex] = { ...state.mergeResults[existingIndex], ...row };
	} else {
		state.mergeResults.push(row);
	}
	return row;
}
