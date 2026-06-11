#!/usr/bin/env node
/**
 * spine tasks
 *
 * FR-UXB-02: validate task PROMPT packets for a planner scope.
 */

import { isCliEntrypoint, writeCommandResult } from './spine-cli/shared.mjs';
import { loadSpineConfig } from './spine-config.mjs';
import { resolveTasksRootPath } from '../src/config/env-overrides.mjs';
import {
	collectPromptValidationFailure,
	discoverTasks,
	formatPromptValidationFailures,
	loadTaskPacket,
} from '../src/tasks/packet/index.mjs';
import { parseScope } from '../src/planner/scope.mjs';

/**
 * @param {{ failures: Array<{ taskId: string, promptPath?: string, errors: string[] }>, totalCount: number, passedCount: number, failedCount: number }} args
 * @returns {string}
 */
export function formatTasksValidateHuman({ failures, totalCount, passedCount, failedCount }) {
	const lines = [`Validated ${totalCount} task(s): ${passedCount} passed, ${failedCount} failed`];
	if (failures.length > 0) {
		lines.push('');
		lines.push(formatPromptValidationFailures(failures).trimEnd());
	}
	return lines.join('\n').trimEnd() + '\n';
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
 * @param {{ projectRoot?: string, scope?: string }} [args]
 * @returns {Promise<{ output: string, exitCode: number, scope: ReturnType<typeof parseScope>, failures: Array<{ taskId: string, promptPath?: string, errors: string[] }> }>}
 */
export async function runSpineTasksValidate({
	projectRoot = process.cwd(),
	scope = 'all',
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

	const selectedTaskIds = new Set(scopeResult.taskIds);
	/** @type {Array<{ taskId: string, promptPath?: string, errors: string[] }>} */
	const failures = [];
	let passedCount = 0;

	for (const discoveredTask of discovered) {
		const taskId = discoveredTask.taskId;
		if (!selectedTaskIds.has(taskId)) continue;

		const packet = loadTaskPacket(discoveredTask.folderPath, {
			contract: config.contract,
		});
		const failure = collectPromptValidationFailure(packet, taskId);
		if (failure) {
			failures.push(failure);
		} else {
			passedCount += 1;
		}
	}

	const totalCount = scopeResult.taskIds.length;
	const failedCount = failures.length;
	const output = formatTasksValidateHuman({
		failures,
		totalCount,
		passedCount,
		failedCount,
	});

	return {
		scope: scopeResult,
		failures,
		output,
		exitCode: failedCount > 0 ? 1 : 0,
	};
}

/**
 * @param {string[]} args
 */
export async function handleTasks(args) {
	const sub = args[0];
	if (sub !== 'validate') {
		const { die, c } = await import('./spine-cli/shared.mjs');
		die(
			`Unknown tasks subcommand: ${sub ?? '(none)'}\nRun ${c.cyan}spine tasks validate <scope>${c.reset} for usage.`,
		);
	}

	const scope = args.slice(1).filter((a) => !a.startsWith('--')).join(' ') || 'all';

	try {
		const result = await runSpineTasksValidate({ projectRoot: process.cwd(), scope });
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

if (isCliEntrypoint(import.meta.url)) {
	handleTasks(process.argv.slice(2));
}
