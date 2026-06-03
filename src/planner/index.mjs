/**
 * src/planner/index.mjs
 *
 * FR-SCHED-01..04..06: build dependency DAG, topological waves, and lane assignment.
 */

import {
	discoverTasks,
	loadTaskPacket,
	loadDependenciesJson,
	mergeTaskDeps,
} from '../tasks/packet/index.mjs';

import { buildGraph, topoWaves } from './graph.mjs';
import { findCyclePath } from './cycles.mjs';
import { assignLanesToWaves } from './lanes.mjs';
import { parseScope } from './scope.mjs';

/**
 * @param {{ scope?: any, config: { lanes?: { maxParallel?: number, queueExcess?: boolean } }, tasksRoot: string }} args
 */
export function buildPlan({ scope, config, tasksRoot }) {
	if (!tasksRoot) throw new Error('buildPlan requires tasksRoot');
	if (!config) throw new Error('buildPlan requires config');

	const discovered = discoverTasks(tasksRoot);
	const scopeResult = parseScope(scope, { tasksRoot, discoveredTasks: discovered });
	const selectedIdsSorted = scopeResult.taskIds;
	const selectedTaskIds = new Set(selectedIdsSorted);

	const depsJson = loadDependenciesJson(tasksRoot);

	/** @type {Record<string, { taskId: string, title: string|null, fileScope: string[], dependencies: string[] }> } */
	const tasksById = {};

	for (const discoveredTask of discovered) {
		const taskId = discoveredTask.taskId;
		if (!selectedTaskIds.has(taskId)) continue;

		const packet = loadTaskPacket(discoveredTask.folderPath);
		const prompt = packet.prompt;
		const mergedDeps = mergeTaskDeps({ taskId, prompt }, depsJson);

		tasksById[taskId] = {
			taskId,
			title: prompt.title ?? null,
			fileScope: Array.isArray(prompt.fileScope) ? prompt.fileScope : [],
			dependencies: mergedDeps,
		};
	}

	/** @type {Record<string, string[]>} */
	const depsByTask = {};
	for (const taskId of selectedIdsSorted) {
		const deps = tasksById[taskId]?.dependencies ?? [];
		depsByTask[taskId] = deps.filter((depId) => Boolean(tasksById[depId]));
	}

	const graph = buildGraph(depsByTask);

	const cycle = findCyclePath(graph);
	if (cycle) {
		throw new Error('Dependency cycle detected: ' + cycle.join(' -> '));
	}

	const { waves, remainingWithDeps } = topoWaves(graph);
	if (remainingWithDeps.length > 0) {
		throw new Error(
			'Unexpected remaining nodes after topo sort (cycle likely): ' + remainingWithDeps.join(', '),
		);
	}

	const maxParallel = config.lanes?.maxParallel ?? 1;
	const queueExcess = config.lanes?.queueExcess ?? true;

	const wavesWithLanes = assignLanesToWaves({
		waves,
		tasksById,
		maxParallel,
		queueExcess,
	});

	return {
		generatedAt: new Date().toISOString(),
		scope: {
			mode: scopeResult.mode,
			taskIds: selectedIdsSorted,
		},
		laneConfig: { maxParallel, queueExcess },
		waves: wavesWithLanes,
		tasks: Object.fromEntries(
			selectedIdsSorted.map((taskId) => [
				taskId,
				{
					taskId,
					title: tasksById[taskId]?.title ?? null,
					fileScope: tasksById[taskId]?.fileScope ?? [],
					dependencies: tasksById[taskId]?.dependencies ?? [],
				},
			]),
		),
		metadata: {
			tasksRoot,
			tasksDiscovered: discovered.length,
			tasksSelected: selectedIdsSorted.length,
			...(scopeResult.mode === 'pending'
				? { tasksExcluded: scopeResult.excludedCount ?? 0 }
				: {}),
		},
	};
}
