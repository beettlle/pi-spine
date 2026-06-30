/**
 * Wave planning with file-scope overlap detection and lane serialization (SP-353 / issue #31).
 */

import { fileScopesOverlap, findWaveFileScopeOverlaps } from './file-scope.mjs';

/**
 * @param {string[]} taskScope
 * @param {string[][]} laneTaskScopes
 * @returns {boolean}
 */
function taskOverlapsLane(taskScope, laneTaskScopes) {
	for (const laneScope of laneTaskScopes) {
		if (fileScopesOverlap(taskScope, laneScope)) return true;
	}
	return false;
}

/**
 * Greedy lane packing using glob-aware overlap checks from file-scope.mjs.
 *
 * @param {{ waves: string[][], tasksById: Record<string, { fileScope?: string[] }>, maxParallel: number, queueExcess?: boolean }} args
 * @returns {Array<{ index: number, taskIds: string[], virtualLaneCount: number, ticks: Array<{ index: number, lanes: string[][] }>, laneAssignments: Record<string, { virtualLane: number, tick: number, laneInTick: number }> }>}
 */
export function assignLanesToWaves({ waves, tasksById, maxParallel, queueExcess = true }) {
	const planned = [];

	for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
		const waveTaskIds = waves[waveIndex];

		/** @type {{ taskScopes: string[][] }} */
		const virtualLanes = [];

		/** @type {Record<string, { virtualLane: number, tick: number, laneInTick: number }>} */
		const laneAssignments = {};

		const virtualLaneForTask = {};

		for (const taskId of waveTaskIds) {
			const task = tasksById[taskId];
			if (!task) {
				throw new Error(`Missing task packet for ${taskId} during lane assignment`);
			}

			const taskScope = Array.isArray(task.fileScope) ? task.fileScope : [];

			let placed = false;
			for (let i = 0; i < virtualLanes.length; i++) {
				const lane = virtualLanes[i];
				if (taskOverlapsLane(taskScope, lane.taskScopes)) {
					virtualLaneForTask[taskId] = i;
					lane.taskScopes.push(taskScope);
					placed = true;
					break;
				}
			}

			if (!placed) {
				const i = virtualLanes.length;
				virtualLanes.push({ taskScopes: [taskScope] });
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

/**
 * @typedef {import('./file-scope.mjs').FileScopeOverlapPair} FileScopeOverlapPair
 */

/**
 * Detect same-wave file-scope overlaps and assign lanes that serialize conflicts.
 *
 * @param {{ waves: string[][], tasksById: Record<string, { fileScope?: string[] }>, maxParallel: number, queueExcess?: boolean }} args
 * @returns {{ waves: ReturnType<typeof assignLanesToWaves>, fileScopeOverlaps: FileScopeOverlapPair[] }}
 */
export function planWaves({ waves, tasksById, maxParallel, queueExcess = true }) {
	const fileScopeOverlaps = findWaveFileScopeOverlaps(waves, tasksById);
	const wavesWithLanes = assignLanesToWaves({
		waves,
		tasksById,
		maxParallel,
		queueExcess,
	});

	return { waves: wavesWithLanes, fileScopeOverlaps };
}

/**
 * Human-readable overlap report lines for plan output consumers.
 *
 * @param {FileScopeOverlapPair[]} overlaps
 * @returns {string[]}
 */
export function formatFileScopeOverlapWarnings(overlaps) {
	if (!Array.isArray(overlaps) || overlaps.length === 0) {
		return [];
	}

	const lines = ['File scope overlaps (tasks serialized to the same lane):'];
	for (const overlap of overlaps) {
		lines.push(`  Wave ${overlap.waveIndex}: ${overlap.taskA} ↔ ${overlap.taskB}`);
	}
	return lines;
}
