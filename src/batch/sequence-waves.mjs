/**
 * Planner sequence wave policy after merge_blocked (GitHub #82, SP-437).
 * Evaluates whether later waves can run per dependencies.json / plan.tasks deps.
 */

/**
 * @param {object|null|undefined} batchState
 * @returns {{ succeeded: string[], failed: string[], skipped: string[], pending: string[] }}
 */
export function collectWaveTaskOutcomes(batchState) {
	const tasks = batchState?.tasks ?? [];
	/** @type {string[]} */
	const succeeded = [];
	/** @type {string[]} */
	const failed = [];
	/** @type {string[]} */
	const skipped = [];
	/** @type {string[]} */
	const pending = [];

	for (const task of tasks) {
		const taskId = String(task?.taskId ?? "");
		if (!taskId) continue;
		const status = String(task?.status ?? "");
		if (status === "succeeded") succeeded.push(taskId);
		else if (status === "failed") failed.push(taskId);
		else if (status === "skipped") skipped.push(taskId);
		else if (status === "pending" || status === "running") pending.push(taskId);
	}

	return { succeeded, failed, skipped, pending };
}

/**
 * @param {object} [params]
 * @param {object|null} [params.startResult]
 * @param {object|null} [params.reconciliation]
 */
export function isMergeBlockedBatchOutcome({ startResult = null, reconciliation = null } = {}) {
	if (startResult?.error === "mixed_outcome_merge_blocked") return true;
	const phase = reconciliation?.phase ?? reconciliation?.signals?.raw?.phase ?? null;
	if (phase === "merge_blocked") return true;
	const lastError = String(reconciliation?.signals?.raw?.lastError ?? "");
	if (phase === "failed" && lastError.includes("§17.4")) return true;
	return false;
}

/**
 * @param {Iterable<string>} doneOnMainTaskIds
 * @param {Array<{ succeeded?: string[], skipped?: string[] }>} priorOutcomes
 */
export function buildSequenceSatisfiedTaskIds(doneOnMainTaskIds = [], priorOutcomes = []) {
	const satisfied = new Set(doneOnMainTaskIds);
	for (const outcome of priorOutcomes) {
		for (const taskId of outcome.succeeded ?? []) satisfied.add(taskId);
		for (const taskId of outcome.skipped ?? []) satisfied.add(taskId);
	}
	return satisfied;
}

/**
 * @param {object} params
 * @param {object} params.plan
 * @param {string[]} params.waveTaskIds
 * @param {Set<string>} params.satisfiedTaskIds
 */
export function evaluateWaveTaskDependencies({ plan, waveTaskIds, satisfiedTaskIds }) {
	const tasks = plan?.tasks ?? {};
	/** @type {string[]} */
	const runnable = [];
	/** @type {Array<{ taskId: string, unsatisfiedDeps: string[] }>} */
	const blocked = [];

	for (const taskId of waveTaskIds) {
		const deps = tasks[taskId]?.dependencies ?? [];
		const unsatisfiedDeps = deps.filter((depId) => !satisfiedTaskIds.has(depId));
		if (unsatisfiedDeps.length === 0) {
			runnable.push(taskId);
		} else {
			blocked.push({ taskId, unsatisfiedDeps });
		}
	}

	return { runnable, blocked };
}

/**
 * @param {object} params
 * @param {number} params.waveIndex
 * @param {Array<{ taskId: string, unsatisfiedDeps: string[] }>} params.blocked
 * @param {number} params.mergeBlockedWaveIndex
 * @param {string[]} [params.failedTaskIds]
 * @param {string[]} [params.succeededTaskIds]
 */
export function formatSequenceWaveSkipMessage({
	waveIndex,
	blocked,
	mergeBlockedWaveIndex,
	failedTaskIds = [],
	succeededTaskIds = [],
}) {
	const lines = [
		`Sequence wave ${waveIndex} skipped (§17.4 mixed-outcome policy — wave ${mergeBlockedWaveIndex} merge blocked).`,
	];

	if (succeededTaskIds.length > 0) {
		lines.push(`Prior wave succeeded task(s): ${succeededTaskIds.join(", ")}.`);
	}
	if (failedTaskIds.length > 0) {
		lines.push(`Prior wave failed task(s): ${failedTaskIds.join(", ")}.`);
	}

	for (const entry of blocked) {
		lines.push(
			`  ${entry.taskId}: blocked by unsatisfied dependencies ${entry.unsatisfiedDeps.join(", ")}.`,
		);
	}

	if (blocked.length === 0) {
		lines.push(`  No runnable tasks in wave ${waveIndex}.`);
	}

	lines.push(
		"Retry or skip failed tasks on the blocked wave, or land succeeded lanes before dependencies unblock.",
	);
	return lines.join("\n");
}

/**
 * @param {object} params
 * @param {object} params.plan
 * @param {number} params.waveIndex
 * @param {string[]} params.waveTaskIds
 * @param {Set<string>} params.satisfiedTaskIds
 * @param {number} params.mergeBlockedWaveIndex
 * @param {string[]} [params.failedTaskIds]
 * @param {string[]} [params.succeededTaskIds]
 */
export function resolveWaveAfterMergeBlocked({
	plan,
	waveIndex,
	waveTaskIds,
	satisfiedTaskIds,
	mergeBlockedWaveIndex,
	failedTaskIds = [],
	succeededTaskIds = [],
}) {
	const { runnable, blocked } = evaluateWaveTaskDependencies({
		plan,
		waveTaskIds,
		satisfiedTaskIds,
	});

	if (runnable.length === 0) {
		return {
			action: "skip",
			runnableTaskIds: [],
			blocked,
			message: formatSequenceWaveSkipMessage({
				waveIndex,
				blocked,
				mergeBlockedWaveIndex,
				failedTaskIds,
				succeededTaskIds,
			}),
		};
	}

	return {
		action: "continue",
		runnableTaskIds: runnable,
		blocked,
		skippedTaskIds: blocked.map((entry) => entry.taskId),
		message:
			blocked.length > 0
				? formatSequenceWaveSkipMessage({
						waveIndex,
						blocked,
						mergeBlockedWaveIndex,
						failedTaskIds,
						succeededTaskIds,
					})
				: null,
	};
}

/**
 * @param {object} params
 * @param {object} params.plan
 * @param {number} params.waveIndex
 * @param {string[]} params.waveTaskIds
 * @param {Set<string>} params.satisfiedTaskIds
 */
export function planSequenceWaveTasks({ plan, waveIndex, waveTaskIds, satisfiedTaskIds }) {
	const { runnable, blocked } = evaluateWaveTaskDependencies({
		plan,
		waveTaskIds,
		satisfiedTaskIds,
	});

	if (runnable.length === 0) {
		return {
			action: "skip",
			runnableTaskIds: [],
			blocked,
			message: `Sequence wave ${waveIndex} skipped — no tasks with satisfied dependencies.`,
		};
	}

	return {
		action: "continue",
		runnableTaskIds: runnable,
		blocked,
		partialSkipMessage:
			blocked.length > 0
				? `Sequence wave ${waveIndex}: skipping tasks with unsatisfied dependencies: ${blocked
						.map((entry) => entry.taskId)
						.join(", ")}.`
				: null,
	};
}
