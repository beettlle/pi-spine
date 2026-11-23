#!/usr/bin/env node
/**
 * spine tasks
 *
 * FR-UXB-02: validate task PROMPT packets for a planner scope.
 */

import path from 'node:path';
import { c, isCliEntrypoint, writeCommandResult } from './spine-cli/shared.mjs';
import { loadSpineConfig } from './spine-config.mjs';
import { resolveTasksRootPath } from '../src/config/env-overrides.mjs';
import { missingConfigHint } from '../src/config/missing-config-hint.mjs';
import { analyzeTasksScope } from '../src/tasks/analyze/index.mjs';
import {
	collectPromptValidationFailure,
	discoverTasks,
	formatPromptValidationFailures,
	loadDependenciesJson,
	loadTaskPacket,
} from '../src/tasks/packet/index.mjs';
import { collectStaleFileScopeMustChangeWarnings } from '../src/tasks/packet/validate-prompt.mjs';
import {
	fetchIssueViaGh,
	scaffoldTaskFolder,
} from '../src/tasks/from-issue.mjs';
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
 * @param {string} [projectRoot]
 * @returns {string[]}
 */
export function collectTaskAdvisoryWarnings(packet, discoveredTask, depsJson, projectRoot) {
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

	if (projectRoot && packet.promptPath && packet.validation?.contract) {
		const promptRelPath = path.relative(projectRoot, packet.promptPath);
		warnings.push(
			...collectStaleFileScopeMustChangeWarnings(
				projectRoot,
				packet.validation.contract,
				promptRelPath,
			),
		);
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
  spine tasks from-issue <n> [options]

${c.bold}Scope:${c.reset}
  Same resolution as ${c.cyan}spine plan${c.reset}: all, pending, task IDs, globs.

${c.bold}Validate options:${c.reset}
  --json            Emit TasksValidateResult JSON (handoff §6.4)
  --warnings-only   Include non-blocking P1 checks as warnings:
                    folder name ≠ heading ID, missing STATUS.md, deps mismatch

${c.bold}Analyze:${c.reset}
  Deterministic structural checks: parallel file-scope overlap, dependency cycles,
  orphan task IDs (blocking); wave M-count, explore refs, PROMPT/JSON deps drift (warnings).

${c.bold}From-issue (#384):${c.reset}
  Fetch a GitHub issue via gh and scaffold {tasksRoot}/SP-###-<slug>/ with
  thin-packet stubs. Contract/File Scope/Steps stay incomplete until the
  operator fills them; dependencies.json is never written.

${c.bold}From-issue options:${c.reset}
  --closes         Mission first line "Closes #N" (default)
  --partial        Mission first line "Partial #N"
  --id SP-###      Explicit task ID (default: CONTEXT.md Next Task ID, read-only)
  --slug SLUG      Folder slug override (default: slugified issue title)
  --next-id SP-### Update CONTEXT.md Next Task ID (explicit opt-in, never automatic)
  --gh CMD         gh command to invoke (default: gh)
  --json           Print scaffold summary as JSON

${c.bold}Exit codes (validate):${c.reset}
  0  all selected tasks pass
  1  one or more PROMPT validation failures
  2  config, tasksRoot, or scope resolution error

${c.bold}Exit codes (analyze):${c.reset}
  0  no blocking findings (warnings alone exit 0)
  1  one or more blocking findings
  2  config, tasksRoot, or scope resolution error

${c.bold}Exit codes (from-issue):${c.reset}
  0  scaffold written
  1  gh fetch, validation, or existing-folder error
  2  config or tasksRoot resolution error

${c.bold}Examples:${c.reset}
  spine tasks validate all
  spine tasks validate pending --warnings-only
  spine tasks validate FX-101 --json
  spine tasks analyze pending
  spine tasks analyze all --json
  spine tasks from-issue 384 --partial --id SP-890
  spine tasks from-issue 384 --next-id SP-891   # explicit CONTEXT.md update
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
			suggestedCommand: missingConfigHint(projectRoot).suggestedCommand,
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
			agents: config.agents,
		});
		const failure = collectPromptValidationFailure(packet, taskId);
		/** @type {string[]} */
		const warnings = warningsOnly
			? [
					...collectTaskAdvisoryWarnings(packet, discoveredTask, depsJson, projectRoot),
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
 * Scaffold an SP-* packet from a GitHub issue (#384). Thin-packet stubs only:
 * Contract/File Scope/Steps stay incomplete until the operator fills them;
 * dependencies.json is never written; CONTEXT.md Next Task ID is touched
 * only when `nextId` is explicitly provided.
 *
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {number} [options.issueNumber]
 * @param {boolean} [options.closes] Mission first line "Closes #N" (CLI default when --partial absent)
 * @param {boolean} [options.partial] Mission first line "Partial #N"
 * @param {string|null} [options.taskId] Explicit task ID (else CONTEXT.md Next Task ID)
 * @param {string|null} [options.slug] Folder slug override
 * @param {string|null} [options.nextId] Explicit CONTEXT.md Next Task ID update
 * @param {string} [options.ghCommand]
 * @param {boolean} [options.json]
 * @returns {Promise<{output: string, exitCode: number}>}
 */
export async function runSpineTasksFromIssue({
	projectRoot = process.cwd(),
	issueNumber,
	closes = false,
	partial = false,
	taskId = null,
	slug = null,
	nextId = null,
	ghCommand = 'gh',
	json = false,
} = {}) {
	if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
		throwTasksValidateError(`Invalid issue number: ${issueNumber ?? '(missing)'}. Expected a positive integer, e.g. spine tasks from-issue 384`);
	}
	if (closes && partial) {
		throwTasksValidateError('Pass only one of --closes / --partial');
	}

	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		throwTasksValidateError(configResult.error.message, {
			suggestedCommand: configResult.error.suggestedCommand,
		});
	}
	const tasksRoot = resolveTasksRootPath(projectRoot, configResult.config);
	if (!tasksRoot) {
		throwTasksValidateError('Cannot scaffold tasks: tasksRoot not configured', {
			suggestedCommand: missingConfigHint(projectRoot).suggestedCommand,
		});
	}

	let issue;
	try {
		issue = fetchIssueViaGh({ issueNumber, projectRoot, ghCommand });
	} catch (err) {
		throwTasksValidateError(err?.message ?? String(err), { exitCode: 1 });
	}

	let scaffold;
	try {
		scaffold = scaffoldTaskFolder({
			tasksRoot,
			issue,
			linkType: partial ? 'partial' : 'closes',
			taskId: taskId ?? undefined,
			slug: slug ?? undefined,
			nextId: nextId ?? undefined,
		});
	} catch (err) {
		throwTasksValidateError(err?.message ?? String(err), { exitCode: 1 });
	}

	const missionLink = `${partial ? 'Partial' : 'Closes'} #${issueNumber}`;
	if (json) {
		const payload = {
			taskId: scaffold.taskId,
			issueNumber,
			missionLink,
			folder: path.relative(projectRoot, scaffold.folderPath),
			promptPath: scaffold.promptPath,
			statusPath: scaffold.statusPath,
			contextNextIdUpdated: scaffold.contextNextIdUpdated,
		};
		return { output: `${JSON.stringify(payload, null, 2)}\n`, exitCode: 0 };
	}

	const relFolder = path.relative(projectRoot, scaffold.folderPath);
	const contextNote = scaffold.contextNextIdUpdated
		? `CONTEXT.md Next Task ID updated via --next-id`
		: `CONTEXT.md unchanged (pass --next-id SP-### to update)`;
	const output = [
		`Scaffolded ${scaffold.taskId} from issue #${issueNumber}`,
		'',
		`  Folder:   ${relFolder}`,
		`  Mission:  ${missionLink} — ${issue.title}`,
		`  Contract: EMPTY — fill Contract / File Scope / Steps before batch start`,
		`  CONTEXT:  ${contextNote}`,
		'',
		`Next: fill the stubs, then run ${c.cyan}spine tasks validate ${scaffold.taskId}${c.reset}.`,
		`No dependencies.json edges were written (add real deps only, with confirmation).`,
		'',
	].join('\n');
	return { output, exitCode: 0 };
}

/**
 * @param {string[]} args
 */
async function handleTasksFromIssue(args) {
	const rest = args.slice(1);
	/** @type {Record<string, string|null>} */
	const flagValues = { '--id': null, '--slug': null, '--next-id': null, '--gh': null };
	const positionals = [];
	let json = false;
	let closes = false;
	let partial = false;
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (arg === '--help' || arg === '-h') {
			printTasksHelp();
			return;
		}
		if (arg === '--json') {
			json = true;
			continue;
		}
		if (arg === '--closes') {
			closes = true;
			continue;
		}
		if (arg === '--partial') {
			partial = true;
			continue;
		}
		if (arg in flagValues) {
			const value = rest[++i];
			if (value === undefined || value.startsWith('--')) {
				console.error(`Error: ${arg} requires a value.`);
				process.exit(2);
			}
			flagValues[arg] = value;
			continue;
		}
		if (arg.startsWith('--')) {
			console.error(`Error: unknown from-issue flag: ${arg}\nRun ${c.cyan}spine help tasks${c.reset} for usage.`);
			process.exit(2);
		}
		positionals.push(arg);
	}
	if (!closes && !partial) closes = true;

	const issueNumber = Number(positionals[0]);
	try {
		const result = await runSpineTasksFromIssue({
			projectRoot: process.cwd(),
			issueNumber,
			closes,
			partial,
			taskId: flagValues['--id'],
			slug: flagValues['--slug'],
			nextId: flagValues['--next-id'],
			ghCommand: flagValues['--gh'] ?? 'gh',
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
	if (sub === 'from-issue') {
		await handleTasksFromIssue(args);
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
