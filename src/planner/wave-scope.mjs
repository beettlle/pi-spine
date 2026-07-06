// @ts-nocheck
/**
 * Planner wave filtering for batch start (GitHub #54 Tier 1 SP-A).
 */

/**
 * @param {string[]} args
 * @returns {{ waveFilter: number|null, error?: string, output?: string }}
 */
export function parseBatchStartWaveFilter(args) {
	const throughIdx = args.indexOf("--through-wave");
	const waveIdx = args.indexOf("--wave");

	if (throughIdx >= 0 && waveIdx >= 0) {
		return {
			waveFilter: null,
			error: "conflicting_wave_flags",
			output:
				"Use either --wave N or --through-wave N for batch start, not both.\n",
		};
	}

	const flagIdx = throughIdx >= 0 ? throughIdx : waveIdx;
	if (flagIdx < 0) {
		return { waveFilter: null };
	}

	const flagName = throughIdx >= 0 ? "--through-wave" : "--wave";
	const raw = args[flagIdx + 1];
	if (raw == null || raw.startsWith("--")) {
		return {
			waveFilter: null,
			error: "wave_flag_missing_value",
			output: `${flagName} requires a non-negative integer wave index.\n`,
		};
	}

	const waveIndex = Number(raw);
	if (!Number.isInteger(waveIndex) || waveIndex < 0) {
		return {
			waveFilter: null,
			error: "wave_flag_invalid_value",
			output: `${flagName} requires a non-negative integer wave index (got ${JSON.stringify(raw)}).\n`,
		};
	}

	return { waveFilter: waveIndex };
}

/**
 * @param {object} plan
 * @param {number} waveIndex
 */
export function resolveWaveTaskIds(plan, waveIndex) {
	const waves = plan?.waves ?? [];
	if (!Number.isInteger(waveIndex) || waveIndex < 0 || waveIndex >= waves.length) {
		return {
			ok: /** @type {const} */ (false),
			error: "wave_out_of_range",
			waveIndex,
			waveCount: waves.length,
			output: `Wave index ${waveIndex} is out of range (plan has ${waves.length} wave(s)).`,
		};
	}

	const taskIds = [...(waves[waveIndex]?.taskIds ?? [])];
	if (taskIds.length === 0) {
		return {
			ok: /** @type {const} */ (false),
			error: "wave_empty",
			waveIndex,
			waveCount: waves.length,
			output: `Planner wave ${waveIndex} has no tasks.`,
		};
	}

	return { ok: /** @type {const} */ (true), waveIndex, taskIds, waveCount: waves.length };
}

/**
 * Restrict a planner plan to a single wave for batch start.
 *
 * @param {object} plan
 * @param {number} waveIndex
 */
export function filterPlanToWave(plan, waveIndex) {
	const resolved = resolveWaveTaskIds(plan, waveIndex);
	if (!resolved.ok) {
		return resolved;
	}

	const selectedWave = plan.waves?.[waveIndex];
	if (!selectedWave) {
		return {
			ok: /** @type {const} */ (false),
			error: "wave_missing",
			waveIndex,
			waveCount: resolved.waveCount,
			output: `Planner wave ${waveIndex} is missing from plan.`,
		};
	}

	/** @type {Record<string, object>} */
	const filteredTasks = {};
	for (const taskId of resolved.taskIds) {
		if (plan.tasks?.[taskId]) {
			filteredTasks[taskId] = plan.tasks[taskId];
		}
	}

	const filteredWave = {
		...selectedWave,
		index: 0,
		taskIds: [...resolved.taskIds],
	};

	return {
		ok: /** @type {const} */ (true),
		waveIndex: resolved.waveIndex,
		taskIds: resolved.taskIds,
		waveCount: resolved.waveCount,
		plan: {
			...plan,
			scope: {
				...plan.scope,
				taskIds: [...resolved.taskIds],
			},
			waves: [filteredWave],
			tasks: filteredTasks,
			metadata: {
				...plan.metadata,
				tasksSelected: resolved.taskIds.length,
				waveFilter: resolved.waveIndex,
			},
		},
	};
}
