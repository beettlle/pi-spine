/**
 * spine deps — dependency graph inspection (FR-SCHED-01 subset).
 */

import { resolveTasksRootPath } from '../config/env-overrides.mjs';
import {
	discoverTasks,
	loadDependenciesJson,
	loadTaskPacket,
	mergeTaskDeps,
} from '../tasks/packet/index.mjs';
import { buildGraph, topoWaves } from '../planner/graph.mjs';
import { findCyclePath } from '../planner/cycles.mjs';
import { parseScope } from '../planner/scope.mjs';

/**
 * @param {string} projectRoot
 * @param {string} scopeArg
 * @param {{ config: { paths: { tasksRoot: string } } }} args
 * @returns {{ mode: string, taskIds: string[] }}
 */
export function resolveDepsScope(projectRoot, scopeArg, { config }) {
	const tasksRoot = resolveTasksRootPath(projectRoot, config);
	if (!tasksRoot) {
		throw new Error('Cannot resolve tasks root');
	}
	const discovered = discoverTasks(tasksRoot);
	return parseScope(scopeArg, { tasksRoot, discoveredTasks: discovered });
}

/**
 * @param {Record<string, string[]>} depsByTask
 * @returns {{ from: string, to: string }[]}
 */
export function depsToEdges(depsByTask) {
	/** @type {{ from: string, to: string }[]} */
	const edges = [];

	for (const [to, deps] of Object.entries(depsByTask)) {
		for (const from of deps ?? []) {
			edges.push({ from: String(from), to: String(to) });
		}
	}

	edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
	return edges;
}

/**
 * @param {string[] | null} cyclePath
 * @returns {string[]}
 */
export function cycleNodesFromPath(cyclePath) {
	if (!cyclePath || cyclePath.length === 0) return [];
	const nodes = cyclePath[cyclePath.length - 1] === cyclePath[0]
		? cyclePath.slice(0, -1)
		: cyclePath;
	return [...new Set(nodes.map(String))].sort();
}

/**
 * @param {{ nodes: string[], edges: { from: string, to: string }[], cycles: string[][], waves?: string[][], scope?: { mode: string, taskIds: string[] } }} report
 * @returns {string}
 */
export function formatDepsHuman(report) {
	const lines = [];
	const mode = report.scope?.mode ?? 'custom';
	lines.push(`\nSpine dependency graph (${mode})`);
	lines.push(`Nodes: ${report.nodes.length}`);
	lines.push('');

	if (report.edges.length === 0) {
		lines.push('(no dependency edges in scope)');
	} else {
		for (const { from, to } of report.edges) {
			lines.push(`${from} → ${to}`);
		}
	}

	if (report.cycles.length > 0) {
		lines.push('');
		for (const cycle of report.cycles) {
			lines.push(`Cycle: ${cycle.join(' → ')}`);
		}
	}

	return lines.join('\n').trimEnd() + '\n';
}

/**
 * @param {{ projectRoot: string, scope?: string, config: { paths: { tasksRoot: string } } }} args
 * @returns {{ nodes: string[], edges: { from: string, to: string }[], cycles: string[][], waves?: string[][], scope: ReturnType<typeof parseScope>, error?: string }}
 */
export function buildDepsReport({ projectRoot, scope = 'all', config }) {
	const tasksRoot = resolveTasksRootPath(projectRoot, config);
	if (!tasksRoot) {
		return { nodes: [], edges: [], cycles: [], scope: { mode: 'custom', taskIds: [] }, error: 'tasks root not configured' };
	}
	const discovered = discoverTasks(tasksRoot);
	const scopeResult = parseScope(scope, { tasksRoot, discoveredTasks: discovered });
	const selectedTaskIds = new Set(scopeResult.taskIds);
	const depsJson = loadDependenciesJson(tasksRoot);

	/** @type {Record<string, string[]>} */
	const depsByTask = {};

	for (const discoveredTask of discovered) {
		const taskId = discoveredTask.taskId;
		if (!selectedTaskIds.has(taskId)) continue;

		const packet = loadTaskPacket(discoveredTask.folderPath);
		const mergedDeps = mergeTaskDeps({ taskId, prompt: packet.prompt }, depsJson);
		depsByTask[taskId] = mergedDeps.map(String);
	}

	const graph = buildGraph(depsByTask);
	const edges = depsToEdges(graph.depsByTask);
	const cyclePath = findCyclePath(graph);
	const cycles = cyclePath ? [cyclePath] : [];
	const { waves, remainingWithDeps } = topoWaves(graph);

	/** @type {{ nodes: string[], edges: { from: string, to: string }[], cycles: string[][], waves?: string[][], scope: typeof scopeResult, error?: string }} */
	const report = {
		scope: scopeResult,
		nodes: graph.nodes,
		edges,
		cycles,
	};

	if (cycles.length === 0 && remainingWithDeps.length === 0) {
		report.waves = waves;
	}

	if (cycles.length > 0) {
		report.error = `Dependency cycle detected: ${cyclePath.join(' -> ')}`;
	}

	return report;
}
