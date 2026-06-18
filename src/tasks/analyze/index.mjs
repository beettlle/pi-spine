/**
 * Deterministic structural checks for task packets in a planner scope (SP-292/SP-298).
 *
 * Blocking checks (warnings are added in SP-299):
 * - Parallel-eligible tasks (same wave) with overlapping ## File Scope
 * - dependencies.json cycles or orphan task IDs
 */

import { resolveTasksRootPath } from '../../config/env-overrides.mjs';
import { loadSpineConfig } from '../../config/spine-config-load.mjs';
import { findCyclePath } from '../../planner/cycles.mjs';
import { buildGraph, topoWaves } from '../../planner/graph.mjs';
import { parseScope } from '../../planner/scope.mjs';
import {
	discoverTasks,
	loadDependenciesJson,
	loadTaskPacket,
	mergeTaskDeps,
} from '../packet/index.mjs';

/** @typedef {'blocking' | 'warning'} AnalyzeSeverity */

/**
 * @typedef {{
 *   severity: AnalyzeSeverity,
 *   code: string,
 *   message: string,
 *   taskIds?: string[],
 *   paths?: string[],
 *   cycle?: string[],
 * }} AnalyzeFinding
 */

function normalizeFileScopePath(p) {
	let s = String(p ?? '').trim();
	if (!s) return null;

	s = s.replace(/\\/g, '/');
	if (s.startsWith('./')) s = s.slice(2);
	s = s.replace(/\/+$/g, '');

	if (s.endsWith('/*')) s = s.slice(0, -2);
	if (s.endsWith('/**')) s = s.slice(0, -3);

	return s || null;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function pathsOverlap(a, b) {
	if (a === b) return true;
	return a.startsWith(b + '/') || b.startsWith(a + '/');
}

/**
 * @param {string[]} left
 * @param {string[]} right
 * @returns {boolean}
 */
export function fileScopesOverlap(left, right) {
	const leftPaths = left.map(normalizeFileScopePath).filter(Boolean);
	const rightPaths = right.map(normalizeFileScopePath).filter(Boolean);

	for (const a of leftPaths) {
		for (const b of rightPaths) {
			if (pathsOverlap(a, b)) return true;
		}
	}

	return false;
}

/**
 * @param {string[][]} waves
 * @param {Record<string, { fileScope?: string[] }>} tasksById
 * @returns {AnalyzeFinding[]}
 */
export function collectParallelFileScopeOverlapFindings(waves, tasksById) {
	/** @type {AnalyzeFinding[]} */
	const findings = [];

	for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
		const waveTaskIds = waves[waveIndex];
		if (waveTaskIds.length < 2) continue;

		for (let i = 0; i < waveTaskIds.length; i++) {
			for (let j = i + 1; j < waveTaskIds.length; j++) {
				const taskA = waveTaskIds[i];
				const taskB = waveTaskIds[j];
				const scopeA = tasksById[taskA]?.fileScope ?? [];
				const scopeB = tasksById[taskB]?.fileScope ?? [];

				if (!fileScopesOverlap(scopeA, scopeB)) continue;

				findings.push({
					severity: 'blocking',
					code: 'parallel_file_scope_overlap',
					message:
						`Parallel-eligible tasks ${taskA} and ${taskB} overlap in ## File Scope (wave ${waveIndex})`,
					taskIds: [taskA, taskB],
					paths: [...new Set([...scopeA, ...scopeB])].sort(),
				});
			}
		}
	}

	return findings;
}

/**
 * @param {{ tasks?: Record<string, string[]> }} depsJson
 * @param {string[]} discoveredTaskIds
 * @returns {string[]}
 */
export function collectOrphanTaskIds(depsJson, discoveredTaskIds) {
	const known = new Set(discoveredTaskIds);
	/** @type {Set<string>} */
	const orphans = new Set();

	for (const [taskId, deps] of Object.entries(depsJson?.tasks ?? {})) {
		if (!known.has(taskId)) orphans.add(taskId);
		for (const dep of deps ?? []) {
			if (!known.has(String(dep))) orphans.add(String(dep));
		}
	}

	return [...orphans].sort();
}

/**
 * @param {string[]} orphanTaskIds
 * @returns {AnalyzeFinding[]}
 */
export function collectOrphanTaskFindings(orphanTaskIds) {
	if (orphanTaskIds.length === 0) return [];

	return [
		{
			severity: 'blocking',
			code: 'orphan_task_id',
			message: `dependencies.json references unknown task ID(s): ${orphanTaskIds.join(', ')}`,
			taskIds: orphanTaskIds,
		},
	];
}

/**
 * @param {ReturnType<typeof buildGraph>} graph
 * @returns {AnalyzeFinding[]}
 */
export function collectDependencyCycleFindings(graph) {
	const cyclePath = findCyclePath(graph);
	if (!cyclePath) return [];

	const cycleNodes = cyclePath[cyclePath.length - 1] === cyclePath[0]
		? cyclePath.slice(0, -1)
		: cyclePath;

	return [
		{
			severity: 'blocking',
			code: 'dependency_cycle',
			message: `Dependency cycle detected: ${cyclePath.join(' -> ')}`,
			taskIds: [...new Set(cycleNodes.map(String))].sort(),
			cycle: cyclePath,
		},
	];
}

/**
 * @param {{ findings: AnalyzeFinding[], scope: ReturnType<typeof parseScope> }} args
 */
export function buildAnalyzeTasksResult({ findings, scope }) {
	const blockingCount = findings.filter((finding) => finding.severity === 'blocking').length;
	const warningCount = findings.filter((finding) => finding.severity === 'warning').length;

	return {
		ok: blockingCount === 0,
		scope: {
			mode: scope.mode,
			taskCount: scope.taskIds.length,
			taskIds: scope.taskIds,
		},
		findings,
		blockingCount,
		warningCount,
	};
}

/**
 * @param {{ findings: AnalyzeFinding[], scope: ReturnType<typeof parseScope> }} args
 * @returns {string}
 */
export function formatAnalyzeTasksHuman({ findings, scope }) {
	const blocking = findings.filter((finding) => finding.severity === 'blocking');
	const warnings = findings.filter((finding) => finding.severity === 'warning');

	const lines = [
		`Analyzed ${scope.taskIds.length} task(s): ${blocking.length} blocking, ${warnings.length} warning`,
	];

	if (findings.length === 0) {
		lines.push('');
		lines.push('No structural issues found.');
	} else {
		lines.push('');
		for (const finding of findings) {
			lines.push(`${finding.severity}: ${finding.message}`);
		}
	}

	return lines.join('\n').trimEnd() + '\n';
}

/**
 * @param {string} message
 * @param {{ suggestedCommand?: string, exitCode?: number }} [options]
 */
function throwAnalyzeError(message, { suggestedCommand, exitCode = 2 } = {}) {
	const err = new Error(message);
	if (suggestedCommand) err.suggestedCommand = suggestedCommand;
	err.exitCode = exitCode;
	throw err;
}

/**
 * @param {{ projectRoot?: string, scope?: string }} [args]
 */
export async function analyzeTasksScope({ projectRoot = process.cwd(), scope = 'all' } = {}) {
	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		throwAnalyzeError(configResult.error.message, {
			suggestedCommand: configResult.error.suggestedCommand,
		});
	}

	const config = configResult.config;
	const tasksRoot = resolveTasksRootPath(projectRoot, config);
	if (!tasksRoot) {
		throwAnalyzeError('Cannot analyze tasks: tasksRoot not configured', {
			suggestedCommand: 'spine init',
		});
	}

	const discovered = discoverTasks(tasksRoot);
	let scopeResult;
	try {
		scopeResult = parseScope(scope, { tasksRoot, discoveredTasks: discovered });
	} catch (err) {
		throwAnalyzeError(err?.message ?? String(err));
	}

	const depsJson = loadDependenciesJson(tasksRoot);
	const discoveredTaskIds = discovered.map((task) => task.taskId);
	const selectedTaskIds = new Set(scopeResult.taskIds);

	/** @type {Record<string, { taskId: string, fileScope: string[], dependencies: string[] }>} */
	const tasksById = {};

	for (const discoveredTask of discovered) {
		const taskId = discoveredTask.taskId;
		if (!selectedTaskIds.has(taskId)) continue;

		const packet = loadTaskPacket(discoveredTask.folderPath, {
			contract: config.contract,
		});
		const prompt = packet.prompt;
		const mergedDeps = mergeTaskDeps({ taskId, prompt }, depsJson);

		tasksById[taskId] = {
			taskId,
			fileScope: Array.isArray(prompt.fileScope) ? prompt.fileScope : [],
			dependencies: mergedDeps,
		};
	}

	/** @type {Record<string, string[]>} */
	const depsByTask = {};
	for (const taskId of scopeResult.taskIds) {
		const deps = tasksById[taskId]?.dependencies ?? [];
		depsByTask[taskId] = deps
			.map(String)
			.filter((depId) => Boolean(tasksById[depId]));
	}

	const graph = buildGraph(depsByTask);
	const { waves, remainingWithDeps } = topoWaves(graph);

	/** @type {AnalyzeFinding[]} */
	const findings = [
		...collectOrphanTaskFindings(collectOrphanTaskIds(depsJson, discoveredTaskIds)),
		...collectDependencyCycleFindings(graph),
	];

	if (findings.some((finding) => finding.code === 'dependency_cycle') === false) {
		if (remainingWithDeps.length > 0) {
			findings.push({
				severity: 'blocking',
				code: 'dependency_cycle',
				message:
					'Unexpected remaining nodes after topo sort (cycle likely): ' +
					remainingWithDeps.join(', '),
				taskIds: remainingWithDeps,
			});
		} else {
			findings.push(...collectParallelFileScopeOverlapFindings(waves, tasksById));
		}
	}

	const result = buildAnalyzeTasksResult({ findings, scope: scopeResult });

	return {
		scope: scopeResult,
		result,
		output: formatAnalyzeTasksHuman({ findings, scope: scopeResult }),
		exitCode: result.ok ? 0 : 1,
	};
}
