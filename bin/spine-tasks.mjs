#!/usr/bin/env node
/**
 * spine tasks
 *
 * FR-UXB-02: validate task PROMPT packets for a planner scope.
 */

import { c, isCliEntrypoint, writeCommandResult } from './spine-cli/shared.mjs';
import { loadSpineConfig } from './spine-config.mjs';
import { resolveTasksRootPath } from '../src/config/env-overrides.mjs';
import { analyzeTasksScope } from '../src/tasks/analyze/index.mjs';
import {
	collectPromptValidationFailure,
	discoverTasks,
	formatPromptValidationFailures,
	loadDependenciesJson,
	loadTaskPacket,
} from '../src/tasks/packet/index.mjs';
import { parseScope } from '../src/planner/scope.mjs';

/**
 * @param {{ failures: Array<{ taskId: string, promptPath?: string, errors: string[] }>, totalCount: number, passedCount: number, failedCount: number, warningsByTask?: Array<{ taskId: string, warnings: string[] }> }} args
 * @returns {string}
 */
export function formatTasksValidateHuman({
	failures,
	totalCount,
	passedCount,
	failedCount,
	warningsByTask = [],
}) {
	const lines = [`Validated ${totalCount} task(s): ${passedCount} passed, ${failedCount} failed`];
	if (warningsByTask.length > 0) {
		lines.push('');
		for (const entry of warningsByTask) {
			lines.push(`${entry.taskId}:`);
			for (const warning of entry.warnings) {
				lines.push(`  - warning: ${warning}`);
			}
		}
	}
	if (failures.length > 0) {
		lines.push('');
		lines.push(formatPromptValidationFailures(failures).trimEnd());
	}
	return lines.join('\n').trimEnd() + '\n';
}

/**
 * @param {object} packet
 * @param {{ taskId: string, folderName: string }} discoveredTask
 * @param {{ tasks?: Record<string, string[]> }} depsJson
 * @returns {string[]}
 */
export function collectTaskAdvisoryWarnings(packet, discoveredTask, depsJson) {
	/** @type {string[]} */
	const warnings = [];

	const headingTaskId = packet.prompt?.taskId;
	if (headingTaskId && discoveredTask.taskId !== headingTaskId) {
		warnings.push(
			`Folder name task ID ${discoveredTask.taskId} does not match PROMPT heading ${headingTaskId}`,
		);
	}

	if (!packet.statusPath) {
		warnings.push('Missing STATUS.md');
	}

	const promptDeps = packet.prompt?.dependencies ?? [];
	if (promptDeps.length > 0) {
		const jsonDeps = depsJson?.tasks?.[discoveredTask.taskId];
		if (!jsonDeps) {
			warnings.push(
				`PROMPT lists dependencies but ${discoveredTask.taskId} is missing from dependencies.json`,
			);
		} else {
			const missing = promptDeps.filter((dep) => !jsonDeps.includes(dep));
			if (missing.length > 0) {
				warnings.push(
					`PROMPT dependencies not in dependencies.json: ${missing.join(', ')}`,
				);
			}
		}
	}

	return warnings;
}

/**
 * @param {object} params
 * @param {ReturnType<typeof parseScope>} params.scope
 * @param {Array<{ taskId: string, ok: boolean, promptPath: string, errors: string[], warnings?: string[], contract?: { ok: boolean, errors: string[] } }>} params.tasks
 * @returns {{ ok: boolean, scope: { mode: string, taskCount: number }, tasks: typeof params.tasks }}
 */
export function buildTasksValidateResult({ scope, tasks }) {
	return {
		ok: tasks.every((task) => task.ok),
		scope: {
			mode: scope.mode,
			taskCount: scope.taskIds.length,
		},
		tasks,
	};
}

export function printTasksHelp() {
	console.log(`
${c.bold}spine tasks${c.reset} — validate and analyze task PROMPT packets (FR-UXB-02)

${c.bold}Usage:${c.reset}
  spine tasks validate <scope> [--json] [--warnings-only]
  spine tasks analyze <scope> [--json]

${c.bold}Scope:${c.reset}
  Same resolution as ${c.cyan}spine plan${c.reset}: all, pending, task IDs, globs.

${c.bold}Validate options:${c.reset}
  --json            Emit TasksValidateResult JSON (handoff §6.4)
  --warnings-only   Include non-blocking P1 checks as warnings:
                    folder name ≠ heading ID, missing STATUS.md, deps mismatch

${c.bold}Analyze:${c.reset}
  Deterministic structural checks: parallel file-scope overlap, dependency cycles,
  orphan task IDs (blocking); wave M-count, explore refs, PROMPT/JSON deps drift (warnings).

${c.bold}Exit codes (validate):${c.reset}
  0  all selected tasks pass
  1  one or more PROMPT validation failures
  2  config, tasksRoot, or scope resolution error

${c.bold}Exit codes (analyze):${c.reset}
  0  no blocking findings (warnings alone exit 0)
  1  one or more blocking findings
  2  config, tasksRoot, or scope resolution error

${c.bold}Examples:${c.reset}
  spine tasks validate all
  spine tasks validate pending --warnings-only
  spine tasks validate FX-101 --json
  spine tasks analyze pending
  spine tasks analyze all --json
`);
}

/**
 * @param {string} message
 * @param {{ suggestedCommand?: string, exitCode?: number }} [options]
 */
function throwTasksValidateError(message, { suggestedCommand, exitCode = 2 } = {}) {
	const err = new Error(message);
	if (suggestedCommand) err.suggestedCommand = suggestedCommand;
	err.exitCode = exitCode;
	throw err;
}

/**
 * @param {{ projectRoot?: string, scope?: string, json?: boolean, warningsOnly?: boolean }} [args]
 */
export async function runSpineTasksValidate({
	projectRoot = process.cwd(),
	scope = 'all',
	json = false,
	warningsOnly = false,
} = {}) {
	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		throwTasksValidateError(configResult.error.message, {
			suggestedCommand: configResult.error.suggestedCommand,
		});
	}

	const config = configResult.config;
	const tasksRoot = resolveTasksRootPath(projectRoot, config);
	if (!tasksRoot) {
		throwTasksValidateError('Cannot validate tasks: tasksRoot not configured', {
			suggestedCommand: 'spine init',
		});
	}

	const discovered = discoverTasks(tasksRoot);
	let scopeResult;
	try {
		scopeResult = parseScope(scope, { tasksRoot, discoveredTasks: discovered });
	} catch (err) {
		throwTasksValidateError(err?.message ?? String(err));
	}

	const depsJson = warningsOnly ? loadDependenciesJson(tasksRoot) : { tasks: {} };
	const selectedTaskIds = new Set(scopeResult.taskIds);
	/** @type {Array<{ taskId: string, promptPath?: string, errors: string[] }>} */
	const failures = [];
	/** @type {Array<{ taskId: string, ok: boolean, promptPath: string, errors: string[], warnings?: string[], contract?: { ok: boolean, errors: string[] } }>} */
	const taskResults = [];
	/** @type {Array<{ taskId: string, warnings: string[] }>} */
	const warningsByTask = [];
	let passedCount = 0;

	for (const discoveredTask of discovered) {
		const taskId = discoveredTask.taskId;
		if (!selectedTaskIds.has(taskId)) continue;

		const packet = loadTaskPacket(discoveredTask.folderPath, {
			contract: config.contract,
		});
		const failure = collectPromptValidationFailure(packet, taskId);
		/** @type {string[]} */
		const warnings = warningsOnly
			? [
					...collectTaskAdvisoryWarnings(packet, discoveredTask, depsJson),
					...(packet.validation?.warnings ?? []),
				]
			: [];

		if (warnings.length > 0) {
			warningsByTask.push({ taskId, warnings });
		}

		const contractErrors = packet.validation?.errors?.filter((error) =>
			/contract/i.test(error),
		);
		const contract =
			packet.validation?.contract?.hasSection || contractErrors?.length
				? {
						ok: (contractErrors?.length ?? 0) === 0,
						errors: contractErrors ?? [],
					}
				: undefined;

		const taskResult = {
			taskId,
			ok: !failure,
			promptPath: packet.promptPath,
			errors: failure?.errors ?? [],
			...(warnings.length > 0 ? { warnings } : {}),
			...(contract ? { contract } : {}),
		};
		taskResults.push(taskResult);

		if (failure) {
			failures.push(failure);
		} else {
			passedCount += 1;
		}
	}

	const totalCount = scopeResult.taskIds.length;
	const failedCount = failures.length;
	const validateResult = buildTasksValidateResult({ scope: scopeResult, tasks: taskResults });
	const output = json
		? JSON.stringify(validateResult, null, 2) + '\n'
		: formatTasksValidateHuman({
				failures,
				totalCount,
				passedCount,
				failedCount,
				warningsByTask,
			});

	return {
		scope: scopeResult,
		failures,
		result: validateResult,
		output,
		exitCode: failedCount > 0 ? 1 : 0,
	};
}

/**
 * @param {string} message
 * @param {{ suggestedCommand?: string, exitCode?: number }} [options]
 */
function throwTasksAnalyzeError(message, { suggestedCommand, exitCode = 2 } = {}) {
	const err = new Error(message);
	if (suggestedCommand) err.suggestedCommand = suggestedCommand;
	err.exitCode = exitCode;
	throw err;
}

/**
 * @param {{ projectRoot?: string, scope?: string, json?: boolean }} [args]
 */
export async function runSpineTasksAnalyze({
	projectRoot = process.cwd(),
	scope = 'all',
	json = false,
} = {}) {
	try {
		const analyzeResult = await analyzeTasksScope({ projectRoot, scope });
		const output = json
			? JSON.stringify(analyzeResult.result, null, 2) + '\n'
			: analyzeResult.output;

		return {
			...analyzeResult,
			output,
		};
	} catch (err) {
		if (err?.exitCode != null) throw err;
		throwTasksAnalyzeError(err?.message ?? String(err));
	}
}

/**
 * @param {string[]} args
 */
async function handleTasksValidate(args) {
	const json = args.includes('--json');
	const warningsOnly = args.includes('--warnings-only');
	const scope = args.filter((a) => !a.startsWith('--')).slice(1).join(' ') || 'all';

	try {
		const result = await runSpineTasksValidate({
			projectRoot: process.cwd(),
			scope,
			json,
			warningsOnly,
		});
		writeCommandResult(result);
	} catch (err) {
		const msg = err?.message ?? String(err);
		if (err?.suggestedCommand) {
			console.error(`Error: ${msg}\nSuggested: ${err.suggestedCommand}`);
		} else {
			console.error(`Error: ${msg}`);
		}
		process.exit(err?.exitCode ?? 2);
	}
}

/**
 * @param {string[]} args
 */
async function handleTasksAnalyze(args) {
	const json = args.includes('--json');
	const scope = args.filter((a) => !a.startsWith('--')).slice(1).join(' ') || 'all';

	try {
		const result = await runSpineTasksAnalyze({
			projectRoot: process.cwd(),
			scope,
			json,
		});
		writeCommandResult(result);
	} catch (err) {
		const msg = err?.message ?? String(err);
		if (err?.suggestedCommand) {
			console.error(`Error: ${msg}\nSuggested: ${err.suggestedCommand}`);
		} else {
			console.error(`Error: ${msg}`);
		}
		process.exit(err?.exitCode ?? 2);
	}
}

/**
 * @param {string[]} args
 */
export async function handleTasks(args) {
	const sub = args[0];
	if (sub === 'validate') {
		await handleTasksValidate(args);
		return;
	}
	if (sub === 'analyze') {
		await handleTasksAnalyze(args);
		return;
	}

	const { die } = await import('./spine-cli/shared.mjs');
	die(
		`Unknown tasks subcommand: ${sub ?? '(none)'}\nRun ${c.cyan}spine help tasks${c.reset} for usage.`,
	);
}

if (isCliEntrypoint(import.meta.url)) {
	handleTasks(process.argv.slice(2));
}
