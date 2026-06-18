/**
 * Post-merge limbo detection — merges done, tasks succeeded, phase still running (SP-204).
 */

import { openIntegrateGateAfterBatchComplete } from "./gate.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { saveSpineBatchState } from "./state.mjs";

/**
 * @param {object|null|undefined} state
 * @param {object} [git]
 */
export function isPostMergeLimbo(state, git = {}) {
	if (!state || typeof state !== "object") return false;
	const phase = String(state.phase ?? "");
	if (phase !== "running" || state.endedAt != null) return false;

	const tasks = state.tasks ?? [];
	if (tasks.length === 0) return false;
	const allSucceeded = tasks.every((task) => String(task?.status ?? "") === "succeeded");
	if (!allSucceeded) return false;

	const mergeResults = state.mergeResults ?? [];
	if (
		mergeResults.length === 0 ||
		!mergeResults.every((entry) => String(entry?.status ?? "") === "succeeded")
	) {
		return false;
	}

	if (git.orchMergedToBase) return false;
	if (git.orchBranchExists === false) return false;

	return true;
}

/**
 * @param {object|null|undefined} state
 * @param {number} waveIndex
 */
export function isLastWaveIndex(state, waveIndex) {
	if (!state || typeof state !== "object") return false;
	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) return false;
	return waveIndex >= totalWaves - 1;
}

/**
 * Finalize immediately after the last wave merge so post-merge limbo never opens
 * (SP-280, SP-281 — attached engine + resume orphan race).
 *
 * @param {object} params
 * @param {boolean} [params.resumed]
 * @param {boolean} [params.resumeForced]
 * @returns {ReturnType<typeof finalizeBatchForIntegrate>|null}
 */
export function maybeFinalizeAfterWaveMerge({
	projectRoot,
	state,
	batchId,
	orchBranch,
	waveIndex,
	resumed = false,
	resumeForced = false,
}) {
	if (String(state.phase ?? "") === "completed") {
		return null;
	}
	if (!isLastWaveIndex(state, waveIndex)) {
		return null;
	}
	if (!isPostMergeLimbo(state)) {
		return null;
	}
	return finalizeBatchForIntegrate({
		projectRoot,
		state,
		batchId,
		orchBranch,
		resumed,
		resumeForced,
	});
}

/**
 * Open integrate gate and mark batch completed (idempotent gate open).
 * Shared by engine completion and resume post-merge limbo fast path (SP-204, SP-280).
 *
 * @param {object} params
 */
export function finalizeBatchForIntegrate({
	projectRoot,
	state,
	batchId,
	orchBranch,
	resumed = false,
	resumeForced = false,
}) {
	const taskIds = (state.tasks ?? []).map((task) => task.taskId);
	const summaryTask =
		taskIds.length === 1 ? taskIds[0] : `${taskIds.length} tasks (${taskIds.join(", ")})`;
	const alreadyCompleted = String(state.phase ?? "") === "completed";

	if (!alreadyCompleted) {
		state.endedAt = Date.now();
	}

	openIntegrateGateAfterBatchComplete({
		projectRoot,
		batchId,
		batchState: { ...state, phase: "completed" },
	});

	if (!alreadyCompleted) {
		state.phase = "completed";
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
		appendJournalEvent(projectRoot, batchId, "batch.completed", {
			taskIds,
			mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
			resumed,
			postMergeLimbo: !resumed,
			resumeForced,
		});
	} else {
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
	}

	const completionLabel = resumed ? "resumed and completed" : "completed";
	const nextSteps = resumed
		? "  → spine gate approve\n  → spine integrate\n  → spine batch complete\n"
		: "  → spine gate status\n  → spine gate approve\n  → spine integrate\n  → spine batch complete\n";

	return {
		ok: true,
		exitCode: 0,
		batchId,
		taskIds,
		taskId: taskIds.length === 1 ? taskIds[0] : undefined,
		orchBranch,
		mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
		output:
			`Batch ${batchId} ${completionLabel}: ${summaryTask} succeeded; merged to ${orchBranch}.\n` +
			nextSteps,
	};
}

/**
 * @param {object} params
 */
export function finalizeResumedBatchForIntegrate(params) {
	return finalizeBatchForIntegrate({ ...params, resumed: true });
}
