/**
 * src/planner/index.mjs
 *
 * FR-SCHED-01..04..06: build dependency DAG, topological waves, and lane assignment.
 */

import {
	collectPromptValidationFailure,
	discoverTasks,
	formatPromptValidationFailures,
	loadTaskPacket,
	loadDependenciesJson,
	mergeTaskDeps,
} from '../tasks/packet/index.mjs';

import { buildGraph, topoWaves } from './graph.mjs';
import { findCyclePath } from './cycles.mjs';
import { parseScope } from './scope.mjs';
import { collectWaveSizeWarnings, formatFileScopeOverlapWarnings, planWaves } from './waves.mjs';
import { assertLocCapstoneReadinessForPlan } from '../config/preflight/loc-capstone.mjs';
import path from 'node:path';

/**
 * @param {{ scope?: any, config: { lanes?: { maxParallel?: number, queueExcess?: boolean } }, tasksRoot: string, projectRoot?: string }} args
 */
export function buildPlan({ scope, config, tasksRoot, projectRoot }) {
	if (!tasksRoot) throw new Error('buildPlan requires tasksRoot');
	if (!config) throw new Error('buildPlan requires config');

	const discovered = discoverTasks(tasksRoot);
	const scopeResult = parseScope(scope, { tasksRoot, discoveredTasks: discovered });
	const selectedIdsSorted = scopeResult.taskIds;
	const selectedTaskIds = new Set(selectedIdsSorted);

	const depsJson = loadDependenciesJson(tasksRoot);

	/** @type {Record<string, { taskId: string, title: string|null, fileScope: string[], dependencies: string[], missionText?: string, folderName?: string }> } */
	const tasksById = {};
	/** @type {Array<{ taskId: string, promptPath?: string, errors: string[] }>} */
	const promptValidationFailures = [];

	for (const discoveredTask of discovered) {
		const taskId = discoveredTask.taskId;
		if (!selectedTaskIds.has(taskId)) continue;

		const packet = loadTaskPacket(discoveredTask.folderPath);
		const validationFailure = collectPromptValidationFailure(packet, taskId);
		if (validationFailure) {
			promptValidationFailures.push(validationFailure);
			continue;
		}

		const prompt = packet.prompt;
		const mergedDeps = mergeTaskDeps({ taskId, prompt }, depsJson);

		tasksById[taskId] = {
			taskId,
			title: prompt.title ?? null,
			fileScope: Array.isArray(prompt.fileScope) ? prompt.fileScope : [],
			dependencies: mergedDeps,
			missionText: prompt.sections?.Mission ?? '',
			folderName: path.basename(discoveredTask.folderPath),
			// Propagate parsed matrix fields so planWaves/assignLanesToWaves expands
			// virtual `SP-X[rowId]` sub-lanes at plan time instead of only at run
			// time in the engine (issue #226). Spread conditionally to mirror
			// parsePrompt's emission so non-matrix tasks gain no new keys.
			...(prompt.matrix ? { matrix: prompt.matrix, matrixColumns: prompt.matrixColumns } : {}),
		};
	}

	if (promptValidationFailures.length > 0) {
		throw new Error(formatPromptValidationFailures(promptValidationFailures));
	}

	const resolvedProjectRoot =
		projectRoot ?? path.resolve(tasksRoot, '..');
	assertLocCapstoneReadinessForPlan({
		projectRoot: resolvedProjectRoot,
		tasks: selectedIdsSorted.map((taskId) => tasksById[taskId]).filter(Boolean),
	});

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

	const { waves: wavesWithLanes, fileScopeOverlaps } = planWaves({
		waves,
		tasksById,
		maxParallel,
		queueExcess,
	});

	const overlapWarnings = formatFileScopeOverlapWarnings(fileScopeOverlaps);
	const waveSizeWarnings = collectWaveSizeWarnings(waves);

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
			...(fileScopeOverlaps.length > 0 ? { fileScopeOverlaps } : {}),
		},
		...(overlapWarnings.length > 0 ? { overlapWarnings } : {}),
		...(waveSizeWarnings.length > 0 ? { waveSizeWarnings } : {}),
	};
}
