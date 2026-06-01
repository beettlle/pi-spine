/**
 * FR-SCHED-03/04: greedy lane assignment subject to file-scope disjointness.
 */

function normalizeFileScopePath(p) {
	let s = String(p ?? '').trim();
	if (!s) return null;

	s = s.replace(/\\/g, '/');
	if (s.startsWith('./')) s = s.slice(2);
	s = s.replace(/\/+$/g, '');

	// Common "globs" used in scopes are treated as directory prefixes.
	if (s.endsWith('/*')) s = s.slice(0, -2);
	if (s.endsWith('/**')) s = s.slice(0, -3);

	return s || null;
}

function pathsOverlap(a, b) {
	if (a === b) return true;
	// Only treat directory-prefix matches; a file prefix without a slash should not match.
	return a.startsWith(b + '/') || b.startsWith(a + '/');
}

function taskOverlapsLane(taskPaths, lanePaths) {
	for (const a of taskPaths) {
		for (const b of lanePaths) {
			if (pathsOverlap(a, b)) return true;
		}
	}
	return false;
}

/**
 * @param {{ waves: string[][], tasksById: Record<string, { fileScope?: string[] }>, maxParallel: number, queueExcess?: boolean }} args
 * @returns {Array<{ index: number, taskIds: string[], virtualLaneCount: number, ticks: Array<{ index: number, lanes: string[][] }>, laneAssignments: Record<string, { virtualLane: number, tick: number, laneInTick: number }> }>
 */
export function assignLanesToWaves({ waves, tasksById, maxParallel, queueExcess = true }) {
	const planned = [];

	for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
		const waveTaskIds = waves[waveIndex];

		/** @type {{ lanePaths: string[] }} */
		const virtualLanes = [];

		/** @type {Record<string, { virtualLane: number, tick: number, laneInTick: number }>} */
		const laneAssignments = {};

		const virtualLaneForTask = {};

		// Greedy packing into virtual lanes.
		for (const taskId of waveTaskIds) {
			const task = tasksById[taskId];
			if (!task) {
				throw new Error(`Missing task packet for ${taskId} during lane assignment`);
			}

			const taskPaths = (task.fileScope ?? [])
				.map(normalizeFileScopePath)
				.filter(Boolean);

			let placed = false;
			for (let i = 0; i < virtualLanes.length; i++) {
				const lane = virtualLanes[i];
				if (!taskOverlapsLane(taskPaths, lane.lanePaths)) {
					virtualLaneForTask[taskId] = i;
					// Append to lane paths so future tasks are checked against everything already assigned.
					lane.lanePaths.push(...taskPaths);
					placed = true;
					break;
				}
			}

			if (!placed) {
				const i = virtualLanes.length;
				virtualLanes.push({ lanePaths: [...taskPaths] });
				virtualLaneForTask[taskId] = i;
			}
		}

		const virtualLaneCount = virtualLanes.length;
		const tickCount = queueExcess ? Math.ceil(virtualLaneCount / maxParallel) : 1;

		const ticks = Array.from({ length: tickCount }, (_, t) => {
			return {
				index: t,
				lanes: Array.from({ length: maxParallel }, () => []),
			};
		});

		for (const taskId of waveTaskIds) {
			const virtualLane = virtualLaneForTask[taskId];
			const tick = queueExcess ? Math.floor(virtualLane / maxParallel) : 0;
			const laneInTick = virtualLane % maxParallel;
			laneAssignments[taskId] = { virtualLane, tick, laneInTick };
			ticks[tick].lanes[laneInTick].push(taskId);
		}

		planned.push({
			index: waveIndex,
			taskIds: waveTaskIds,
			virtualLaneCount,
			ticks,
			laneAssignments,
		});
	}

	return planned;
}
