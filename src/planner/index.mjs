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
} from '../compat/taskplane/index.mjs';

import { buildGraph, topoWaves } from './graph.mjs';
import { findCyclePath } from './cycles.mjs';
import { assignLanesToWaves } from './lanes.mjs';

function resolveScopeToTaskIds(scope, allTaskIds) {
	if (scope == null || scope === 'all') return new Set(allTaskIds);

	if (Array.isArray(scope)) return new Set(scope.map(String));

	if (typeof scope === 'object' && Array.isArray(scope.taskIds)) {
		return new Set(scope.taskIds.map(String));
	}

	if (typeof scope === 'string') {
		// Step 2 will formalize scope parsing; for Step 1 we treat unknown strings as "all".
		return new Set(allTaskIds);
	}

	throw new Error('Unsupported scope shape: ' + String(scope));
}

/**
 * @param {{ scope?: any, config: { lanes?: { maxParallel?: number, queueExcess?: boolean } }, tasksRoot: string }} args
 */
export function buildPlan({ scope, config, tasksRoot }) {
	if (!tasksRoot) throw new Error('buildPlan requires tasksRoot');
	if (!config) throw new Error('buildPlan requires config');

	const discovered = discoverTasks(tasksRoot);
	const allTaskIds = discovered.map((t) => t.taskId);

	const selectedTaskIds = resolveScopeToTaskIds(scope, allTaskIds);

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

	const selectedIdsSorted = Array.from(selectedTaskIds)
		.filter((id) => tasksById[id])
		.sort();

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
			mode: scope == null ? 'all' : scope === 'all' ? 'all' : 'custom',
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
		},
	};
}
