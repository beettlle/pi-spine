/**
 * Pure resume validation helpers — leaf module (SP-468 / #83-B).
 * No reconcile import; I/O wrappers live in resume-multi-validate.mjs.
 */

import { isPostMergeLimbo } from "./limbo-detect.mjs";
import {
	findFirstWaveNeedingMerge,
	succeededWaveMergeIndices,
	waveTasksAllTerminal,
} from "./merge/wave-merge-state.mjs";

/**
 * Resume-time post-merge limbo from state, git, journal, and gate signals (pure).
 *
 * @param {object} params
 * @param {object|null|undefined} params.state
 * @param {object} [params.git]
 * @param {object[]} [params.journalEvents]
 * @param {boolean} [params.gateRecordExists]
 */
export function detectPostMergeLimboFromResumeSignals({
	state,
	git = {},
	journalEvents = [],
	gateRecordExists = false,
}) {
	if (!state || typeof state !== "object") return false;
	if (String(state.phase ?? "") === "completed") return false;

	if (isPostMergeLimbo(state)) return true;
	if (isPostMergeLimbo(state, git)) return true;

	const phase = String(state.phase ?? "");
	if (phase !== "running" && phase !== "merging") return false;
	if (state.endedAt != null) return false;
	if (!git.orchBranchExists || git.orchMergedToBase) return false;

	const batchId = String(state.batchId ?? "");
	if (!batchId || gateRecordExists) return false;

	const tasks = state.tasks ?? [];
	if (tasks.length === 0) return false;
	const allSucceeded = tasks.every((task) => String(task?.status ?? "") === "succeeded");
	if (!allSucceeded) return false;

	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) return false;

	const mergeCompleted = (journalEvents ?? []).filter((event) => event.type === "batch.merge_completed");
	if (mergeCompleted.length < 1) return false;

	const lastWaveIndex = totalWaves - 1;
	return mergeCompleted.some((event) => Number(event.payload?.waveIndex ?? -1) === lastWaveIndex);
}

/**
 * @param {object} state
 * @param {object} task
 */
export function isTaskResumable(state, task) {
	const status = String(task.status ?? "").toLowerCase();
	if (status === "pending" || status === "running") return true;

	return (state.segments ?? []).some((segment) => {
		if (!segment || segment.taskId !== task.taskId) return false;
		const segmentStatus = String(segment.status ?? "").toLowerCase();
		return segmentStatus === "pending" || segmentStatus === "running";
	});
}

/**
 * @param {object} state
 */
export function computePendingTasks(state) {
	return (state.tasks ?? []).filter((task) => task && isTaskResumable(state, task));
}

/**
 * @param {object} state
 * @param {object[]} pendingTasks
 */
export function findResumableWave(state, pendingTasks) {
	const pendingIds = new Set(pendingTasks.map((task) => task.taskId));
	const wavePlan = state.wavePlan ?? [];
	const succeededMerges = succeededWaveMergeIndices(state);

	for (let waveIndex = 0; waveIndex < wavePlan.length; waveIndex++) {
		if (succeededMerges.has(waveIndex) && waveTasksAllTerminal(state, waveIndex)) {
			continue;
		}
		const waveTaskIds = wavePlan[waveIndex] ?? [];
		if (waveTaskIds.some((taskId) => pendingIds.has(taskId))) {
			return waveIndex;
		}
	}

	const pendingMergeWave = findFirstWaveNeedingMerge(state);
	if (pendingMergeWave != null) {
		return pendingMergeWave;
	}

	return Number(state.currentWaveIndex ?? 0);
}

/**
 * Classify tasks for orphan detection during resume validation (status-only).
 *
 * @param {object[]} tasks
 */
export function classifyTasksForOrphanDetect(tasks) {
	return (tasks ?? []).map((task) => {
		const status = String(task?.status ?? "").toLowerCase();
		return {
			taskId: task.taskId,
			laneNumber: task.laneNumber,
			classification: status === "running" ? "running" : status,
		};
	});
}
