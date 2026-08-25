/**
 * Deterministic structural checks for task packets in a planner scope (SP-292/SP-298/SP-299).
 *
 * Blocking checks:
 * - Parallel-eligible tasks (same wave) with overlapping ## File Scope
 * - dependencies.json cycles or orphan task IDs
 *
 * Warning checks (SP-299):
 * - Wave with more than four M-sized tasks
 * - CONTEXT.md references explore findings.md that is missing
 * - PROMPT ## Dependencies drift from dependencies.json
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolveTasksRootPath } from '../../config/env-overrides.mjs';
import { loadSpineConfig } from '../../config/spine-config-load.mjs';
import { findCyclePath } from '../../planner/cycles.mjs';
import {
	fileScopesOverlap as plannerFileScopesOverlap,
	pathsOverlap as plannerPathsOverlap,
} from '../../planner/file-scope.mjs';
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

/**
 * Re-exported from the planner so `spine tasks analyze` uses the same
 * glob-aware overlap detection (brace globs and extension probes, #269).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function pathsOverlap(a, b) {
	return plannerPathsOverlap(a, b);
}

/**
 * Re-exported from the planner so `spine tasks analyze` flags the same brace
 * glob and extension collisions as the wave planner (#269).
 *
 * @param {string[]} left
 * @param {string[]} right
 * @returns {boolean}
 */
export function fileScopesOverlap(left, right) {
	return plannerFileScopesOverlap(left, right);
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

const WAVE_M_COUNT_THRESHOLD = 4;

const EXPLORE_FINDINGS_PATH_RE = /_explore\/([a-zA-Z0-9][a-zA-Z0-9_-]*)\/findings\.md/g;

/**
 * @param {string} contextMarkdown
 * @returns {string[]}
 */
export function extractExploreSlugsFromContext(contextMarkdown) {
	/** @type {Set<string>} */
	const slugs = new Set();
	let match = EXPLORE_FINDINGS_PATH_RE.exec(contextMarkdown);
	while (match) {
		slugs.add(match[1]);
		match = EXPLORE_FINDINGS_PATH_RE.exec(contextMarkdown);
	}
	return [...slugs].sort();
}

/**
 * @param {string[][]} waves
 * @param {Record<string, { size?: string | null }>} tasksById
 * @returns {AnalyzeFinding[]}
 */
export function collectWaveMCountFindings(waves, tasksById) {
	/** @type {AnalyzeFinding[]} */
	const findings = [];

	for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
		const mTaskIds = waves[waveIndex].filter((taskId) => tasksById[taskId]?.size === 'M');
		if (mTaskIds.length <= WAVE_M_COUNT_THRESHOLD) continue;

		findings.push({
			severity: 'warning',
			code: 'wave_m_count',
			message:
				`Wave ${waveIndex} includes ${mTaskIds.length} M-sized tasks (>4) — ` +
				'consider smaller parallel waves',
			taskIds: mTaskIds,
		});
	}

	return findings;
}

/**
 * @param {string} tasksRoot
 * @param {string} contextMarkdown
 * @returns {AnalyzeFinding[]}
 */
export function collectExploreReferenceFindings(tasksRoot, contextMarkdown) {
	if (!contextMarkdown) return [];

	/** @type {AnalyzeFinding[]} */
	const findings = [];

	for (const slug of extractExploreSlugsFromContext(contextMarkdown)) {
		const relPath = `_explore/${slug}/findings.md`;
		const findingsPath = path.join(tasksRoot, '_explore', slug, 'findings.md');
		if (fs.existsSync(findingsPath)) continue;

		findings.push({
			severity: 'warning',
			code: 'explore_findings_missing',
			message: `CONTEXT references ${relPath} but file is missing`,
			paths: [relPath],
		});
	}

	return findings;
}

/**
 * @param {Record<string, { promptDependencies?: string[] }>} tasksById
 * @param {{ tasks?: Record<string, string[]> }} depsJson
 * @returns {AnalyzeFinding[]}
 */
export function collectPromptJsonDepsDriftFindings(tasksById, depsJson) {
	/** @type {AnalyzeFinding[]} */
	const findings = [];

	for (const [taskId, task] of Object.entries(tasksById)) {
		const promptDeps = task.promptDependencies ?? [];
		if (promptDeps.length === 0) continue;

		const jsonDeps = depsJson?.tasks?.[taskId];
		if (!jsonDeps) {
			findings.push({
				severity: 'warning',
				code: 'prompt_deps_json_missing',
				message: `PROMPT lists dependencies but ${taskId} is missing from dependencies.json`,
				taskIds: [taskId],
			});
			continue;
		}

		const missing = promptDeps.filter((depId) => !jsonDeps.includes(depId));
		if (missing.length === 0) continue;

		findings.push({
			severity: 'warning',
			code: 'prompt_deps_json_drift',
			message:
				`PROMPT dependencies not in dependencies.json for ${taskId}: ${missing.join(', ')}`,
			taskIds: [taskId],
		});
	}

	return findings;
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

	/** @type {Record<string, { taskId: string, fileScope: string[], dependencies: string[], size: string | null, promptDependencies: string[] }>} */
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
			size: prompt.size ?? null,
			promptDependencies: Array.isArray(prompt.dependencies) ? prompt.dependencies : [],
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

	const contextPath = path.join(tasksRoot, 'CONTEXT.md');
	const contextMarkdown = fs.existsSync(contextPath)
		? fs.readFileSync(contextPath, 'utf-8')
		: '';

	findings.push(
		...collectWaveMCountFindings(waves, tasksById),
		...collectExploreReferenceFindings(tasksRoot, contextMarkdown),
		...collectPromptJsonDepsDriftFindings(tasksById, depsJson),
	);

	const result = buildAnalyzeTasksResult({ findings, scope: scopeResult });

	return {
		scope: scopeResult,
		result,
		output: formatAnalyzeTasksHuman({ findings, scope: scopeResult }),
		exitCode: result.ok ? 0 : 1,
	};
}
