// @ts-nocheck
/**
 * Wave planning with file-scope overlap detection and lane serialization (SP-353 / issue #31).
 */

import { fileScopesOverlap, findWaveFileScopeOverlaps } from './file-scope.mjs';
import { deriveMatrixRowId } from './matrix.mjs';

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
		const rawWaveTaskIds = waves[waveIndex];
		const waveTaskIds = [];

		for (const taskId of rawWaveTaskIds) {
			const task = tasksById[taskId];
			if (!task) {
				throw new Error(`Missing task packet for ${taskId} during lane assignment`);
			}

			if (task.matrix && Array.isArray(task.matrix) && task.matrix.length > 0) {
				for (const row of task.matrix) {
					const rowId = deriveMatrixRowId(row, task.matrixColumns || []);
					const subTaskId = `${taskId}[${rowId}]`;
					waveTaskIds.push(subTaskId);
					if (!tasksById[subTaskId]) {
						tasksById[subTaskId] = {
							...task,
							taskId: subTaskId,
							matrixRow: row,
							parentTaskId: taskId
						};
					}
				}
			} else {
				waveTaskIds.push(taskId);
			}
		}

		/** @type {{ taskScopes: string[][], taskIds: string[] }} */
		const virtualLanes = [];

		/** @type {Record<string, { virtualLane: number, tick: number, laneInTick: number }>} */
		const laneAssignments = {};

		const virtualLaneForTask = {};

		for (const taskId of waveTaskIds) {
			const task = tasksById[taskId];
			
			const taskScope = Array.isArray(task.fileScope) ? task.fileScope : [];

			let placed = false;
			for (let i = 0; i < virtualLanes.length; i++) {
				const lane = virtualLanes[i];
				
				const hasSameParent = lane.taskIds.some(id => {
					const other = tasksById[id];
					return other && other.parentTaskId && other.parentTaskId === task.parentTaskId;
				});

				if (!hasSameParent && taskOverlapsLane(taskScope, lane.taskScopes)) {
					virtualLaneForTask[taskId] = i;
					lane.taskScopes.push(taskScope);
					lane.taskIds.push(taskId);
					placed = true;
					break;
				}
			}

			if (!placed) {
				const i = virtualLanes.length;
				virtualLanes.push({ taskScopes: [taskScope], taskIds: [taskId] });
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

/** Topological waves with more than this many tasks trigger a planner warning (FR-STA-12 / issue #143). */
export const WAVE_SIZE_WARN_THRESHOLD = 8;

/**
 * Collect warning lines when any wave exceeds the task limit.
 * Mega-waves stall pi workers (Phase 15 / SP-086–088).
 *
 * @param {string[][]} waves
 * @returns {string[]}
 */
export function collectWaveSizeWarnings(waves) {
	if (!Array.isArray(waves) || waves.length === 0) {
		return [];
	}

	/** @type {Array<{ waveIndex: number, taskCount: number }>} */
	const oversized = [];
	for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
		const taskIds = waves[waveIndex];
		const taskCount = Array.isArray(taskIds) ? taskIds.length : 0;
		if (taskCount > WAVE_SIZE_WARN_THRESHOLD) {
			oversized.push({ waveIndex, taskCount });
		}
	}

	if (oversized.length === 0) {
		return [];
	}

	const lines = [
		`Wave size warning: ${oversized.length} wave(s) exceed ${WAVE_SIZE_WARN_THRESHOLD} tasks (mega-waves stall pi workers):`,
	];
	for (const { waveIndex, taskCount } of oversized) {
		lines.push(`  Wave ${waveIndex}: ${taskCount} tasks`);
	}
	lines.push(
		'  Split waves per create-spine-tasks guidance (prefer ≤4 M-sized tasks per wave; see skills/create-spine-tasks/SKILL.md).',
	);
	return lines;
}
