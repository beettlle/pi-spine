/**
 * Human-readable plan output for `spine plan` and `/spine-plan`.
 */

/**
 * @param {string} taskId
 * @param {Record<string, { title?: string|null }>|undefined} tasks
 */
function formatTaskLine(taskId, tasks) {
	const title = tasks?.[taskId]?.title?.trim();
	if (title) {
		return `${taskId} — ${title}`;
	}
	return taskId;
}

/**
 * @param {Array<{ tickIndex: number, lanes: Array<{ laneNumber: number, taskIds: string[] }> }>} rounds
 */
function summarizeWave(wave, rounds) {
	const totalTasks = wave.taskIds?.length ?? 0;
	if (totalTasks === 0) return "empty";

	const maxLanesInRound = Math.max(...rounds.map((r) => r.lanes.length), 0);
	const hasSerialLane = rounds.some((r) => r.lanes.some((l) => l.taskIds.length > 1));
	const multiRound = rounds.length > 1;

	if (multiRound) {
		return `${totalTasks} tasks · ${rounds.length} rounds (queued by maxParallel)`;
	}
	if (maxLanesInRound > 1 && !hasSerialLane) {
		return `${totalTasks} tasks · ${maxLanesInRound} lanes in parallel`;
	}
	if (hasSerialLane) {
		return `serial · ${totalTasks} tasks (overlapping file scope)`;
	}
	if (totalTasks === 1) {
		return "1 task";
	}
	return `${totalTasks} tasks`;
}

/**
 * @param {{ index: number, taskIds: string[], ticks?: Array<{ index: number, lanes: string[][] }> }} wave
 * @param {Record<string, { title?: string|null }>|undefined} tasks
 */
function formatWaveLines(wave, tasks) {
	const lines = [];

	const rounds = [];
	for (const tick of wave.ticks ?? []) {
		const lanes = (tick.lanes ?? [])
			.map((taskIds, laneIndex) => ({
				laneNumber: laneIndex + 1,
				taskIds: taskIds.filter(Boolean),
			}))
			.filter((lane) => lane.taskIds.length > 0);
		if (lanes.length > 0) {
			rounds.push({ tickIndex: tick.index, lanes });
		}
	}

	lines.push(`Wave ${wave.index} · ${summarizeWave(wave, rounds)}`);

	const multiRound = rounds.length > 1;
	for (const round of rounds) {
		if (multiRound) {
			const parallelCount = round.lanes.length;
			const roundLabel =
				parallelCount > 1
					? `Round ${round.tickIndex + 1} (${parallelCount} parallel)`
					: `Round ${round.tickIndex + 1}`;
			lines.push(`  ${roundLabel}:`);
		}

		for (const lane of round.lanes) {
			if (lane.taskIds.length === 1) {
				const prefix = multiRound ? "    " : "  ";
				lines.push(`${prefix}Lane ${lane.laneNumber}: ${formatTaskLine(lane.taskIds[0], tasks)}`);
				continue;
			}

			const prefix = multiRound ? "    " : "  ";
			lines.push(`${prefix}Lane ${lane.laneNumber} (serial):`);
			for (const taskId of lane.taskIds) {
				lines.push(`    · ${formatTaskLine(taskId, tasks)}`);
			}
		}
	}

	return lines;
}

/**
 * @param {{ scope?: { mode?: string }, metadata?: { tasksSelected?: number, tasksExcluded?: number }, laneConfig?: { maxParallel?: number }, waves?: any[], tasks?: Record<string, { title?: string|null }> }} plan
 */
export function formatPlanHuman(plan) {
	const lines = [];
	const mode = plan.scope?.mode ?? "custom";
	const taskCount =
		plan.metadata?.tasksSelected ?? (plan.tasks ? Object.keys(plan.tasks).length : "unknown");
	const waveCount = plan.waves?.length ?? 0;
	const maxParallel = plan.laneConfig?.maxParallel ?? 1;

	lines.push(`Spine plan — ${mode}`);
	lines.push(`${taskCount} task(s) · ${waveCount} wave(s) · maxParallel ${maxParallel}`);
	if (plan.scope?.mode === "pending" && plan.metadata?.tasksExcluded != null) {
		lines.push(`${plan.metadata.tasksExcluded} excluded (.DONE on disk)`);
	}
	lines.push("");

	for (const wave of plan.waves ?? []) {
		lines.push(...formatWaveLines(wave, plan.tasks));
		lines.push("");
	}

	const firstWave = plan.waves?.[0];
	if (firstWave?.taskIds?.length) {
		lines.push(`Start: spine batch start ${firstWave.taskIds.join(" ")}`);
	}

	if ((plan.waves?.length ?? 0) > 1) {
		lines.push("Then (after each wave lands):");
		for (const wave of plan.waves.slice(1)) {
			lines.push(`  Wave ${wave.index}: spine batch start ${wave.taskIds.join(" ")}`);
		}
	}

	return `${lines.join("\n").trimEnd()}\n`;
}
