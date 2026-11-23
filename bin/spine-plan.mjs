#!/usr/bin/env node
/**
 * spine plan
 *
 * FR-SCHED-05: write plan artifact and provide human or JSON output.
 */

import fs from 'node:fs';
import path from 'node:path';

import { isCliEntrypoint } from './spine-cli/shared.mjs';
import { loadSpineConfig } from './spine-config.mjs';
import { resolveTasksRootPath } from '../src/config/env-overrides.mjs';
import { missingConfigHint } from '../src/config/missing-config-hint.mjs';
import { buildPlan } from '../src/planner/index.mjs';
import { formatPlanHuman } from '../src/planner/format-plan.mjs';
import { parseBoardSelectArgs, runBoardSelect } from '../src/cli/board-select.mjs';

export { formatPlanHuman } from '../src/planner/format-plan.mjs';

function getTimestampForFilename(d = new Date()) {
	// Keep filename safe across platforms.
	return d.toISOString().replace(/[:.]/g, '-');
}

async function writePlanArtifact({ projectRoot, plan }) {
	const runtimeDir = path.join(projectRoot, '.spine', 'runtime');
	await fs.promises.mkdir(runtimeDir, { recursive: true });
	const timestamp = getTimestampForFilename();
	const artifactPath = path.join(runtimeDir, `plan-${timestamp}.json`);
	await fs.promises.writeFile(artifactPath, JSON.stringify(plan, null, 2), 'utf-8');
	return artifactPath;
}
/**
 * Format a friendly informational message when pending scope has zero tasks.
 *
 * @param {{ excludedCount?: number, discoveredCount?: number }} meta
 * @param {{ maxParallel?: number }} laneConfig
 * @param {{ json?: boolean }} options
 */
function formatEmptyPendingResult({ excludedCount = 0, discoveredCount = 0 }, laneConfig, { json = false } = {}) {
	if (json) {
		const syntheticPlan = {
			generatedAt: new Date().toISOString(),
			scope: { mode: 'pending', taskIds: [] },
			laneConfig,
			waves: [],
			tasks: {},
			metadata: { tasksDiscovered: discoveredCount, tasksSelected: 0, tasksExcluded: excludedCount },
		};
		return { plan: syntheticPlan, artifactPath: null, output: JSON.stringify(syntheticPlan, null, 2) };
	}

	const lines = [
		'Spine plan — pending',
		`0 task(s) · 0 wave(s) · maxParallel ${laneConfig.maxParallel ?? 1}`,
		`${excludedCount} excluded (.DONE on disk)`,
		'',
		'No pending tasks — all discovered tasks have .DONE on disk.',
		'',
		'\u2192 spine plan all',
		'',
	];
	return { plan: null, artifactPath: null, output: lines.join('\n') };
}

/**
 * Build the plan, write the artifact, and return formatted output.
 * SP-877 (#319): the artifact write is a real `await` — the signature is
 * no longer fake-async (async with zero awaits).
 *
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.scope]
 * @param {boolean} [options.json]
 * @returns {Promise<{ plan: object|null, artifactPath: string|null, output: string }>}
 */
export async function runSpinePlan({
	projectRoot = process.cwd(),
	scope = 'all',
	json = false,
} = {}) {
	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		const err = new Error(configResult.error.message);
		err.suggestedCommand = configResult.error.suggestedCommand;
		throw err;
	}

	const config = configResult.config;
	const tasksRoot = resolveTasksRootPath(projectRoot, config);
	if (!tasksRoot) {
		const err = new Error('Cannot build plan: tasksRoot not configured');
		err.suggestedCommand = missingConfigHint(projectRoot).suggestedCommand;
		throw err;
	}

	let plan;
	try {
		plan = buildPlan({ scope, config, tasksRoot });
	} catch (err) {
		if (err?.code === 'NO_PENDING_TASKS') {
			const laneConfig = { maxParallel: config.lanes?.maxParallel ?? 1 };
			return formatEmptyPendingResult(
				{ excludedCount: err.excludedCount, discoveredCount: err.discoveredCount },
				laneConfig,
				{ json },
			);
		}
		throw err;
	}

	const artifactPath = await writePlanArtifact({ projectRoot, plan });

	if (json) {
		return { plan, artifactPath, output: JSON.stringify(plan, null, 2) };
	}

	return { plan, artifactPath, output: formatPlanHuman(plan) };
}

async function main() {
	const argv = process.argv.slice(2);
	const json = argv.includes('--json');

	// SP-889 (#386): board selection — GitHub label/milestone → pending task IDs.
	const board = parseBoardSelectArgs(argv);
	if (board.labels.length > 0 || (board.milestone !== null && board.milestone !== '')) {
		try {
			const { output } = await runBoardSelect({
				projectRoot: process.cwd(),
				labels: board.labels,
				milestone: board.milestone,
				printIds: board.printIds,
				json,
			});
			process.stdout.write(output + '\n');
		} catch (err) {
			const msg = err?.message ?? String(err);
			if (err?.suggestedCommand) {
				console.error(`Error: ${msg}\nSuggested: ${err.suggestedCommand}`);
			} else {
				console.error(`Error: ${msg}`);
			}
			process.exit(1);
		}
		return;
	}

	const scope = board.rest.filter((a) => !a.startsWith('--')).join(' ') || 'all';

	try {
		const { output } = await runSpinePlan({ projectRoot: process.cwd(), scope, json });
		process.stdout.write(output);
	} catch (err) {
		const msg = err?.message ?? String(err);
		if (err?.suggestedCommand) {
			console.error(`Error: ${msg}\nSuggested: ${err.suggestedCommand}`);
		} else {
			console.error(`Error: ${msg}`);
		}
		process.exit(1);
	}
}

if (isCliEntrypoint(import.meta.url)) {
	main();
}
