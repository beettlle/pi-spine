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
 * Open integrate gate and mark batch completed (idempotent gate open).
 *
 * @param {object} params
 */
export function finalizeResumedBatchForIntegrate({
	projectRoot,
	state,
	batchId,
	orchBranch,
	resumeForced = false,
}) {
	state.endedAt = Date.now();
	openIntegrateGateAfterBatchComplete({
		projectRoot,
		batchId,
		batchState: { ...state, phase: "completed" },
	});
	state.phase = "completed";
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "batch.completed", {
		taskIds: (state.tasks ?? []).map((task) => task.taskId),
		mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
		resumed: true,
		postMergeLimbo: true,
		resumeForced,
	});

	const taskIds = (state.tasks ?? []).map((task) => task.taskId);
	const summaryTask =
		taskIds.length === 1 ? taskIds[0] : `${taskIds.length} tasks (${taskIds.join(", ")})`;

	return {
		ok: true,
		exitCode: 0,
		batchId,
		taskIds,
		taskId: taskIds.length === 1 ? taskIds[0] : undefined,
		mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
		output:
			`Batch ${batchId} resumed and completed: ${summaryTask} succeeded; merged to ${orchBranch}.\n` +
			`  → spine gate approve\n  → spine integrate\n  → spine batch complete\n`,
	};
}
