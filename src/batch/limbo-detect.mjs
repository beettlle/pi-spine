/**
 * Post-merge limbo predicates — pure state readers (leaf module, SP-424 / #83-A).
 */

/**
 * Whether batch state matches post-merge limbo: tasks and merges succeeded,
 * phase still running, orch branch exists but not merged to base.
 *
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
