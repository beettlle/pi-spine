#!/usr/bin/env node
/**
 * spine plan
 *
 * FR-SCHED-05: write plan artifact and provide human or JSON output.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpineConfig } from './spine-config.mjs';
import { resolveTasksRootPath } from '../src/config/env-overrides.mjs';
import { buildPlan } from '../src/planner/index.mjs';
import { formatPlanHuman } from '../src/planner/format-plan.mjs';

export { formatPlanHuman } from '../src/planner/format-plan.mjs';

function getTimestampForFilename(d = new Date()) {
	// Keep filename safe across platforms.
	return d.toISOString().replace(/[:.]/g, '-');
}

function writePlanArtifact({ projectRoot, plan }) {
	const runtimeDir = path.join(projectRoot, '.spine', 'runtime');
	fs.mkdirSync(runtimeDir, { recursive: true });
	const timestamp = getTimestampForFilename();
	const artifactPath = path.join(runtimeDir, `plan-${timestamp}.json`);
	fs.writeFileSync(artifactPath, JSON.stringify(plan, null, 2), 'utf-8');
	return artifactPath;
}

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
		err.suggestedCommand = 'spine init';
		throw err;
	}
	const plan = buildPlan({ scope, config, tasksRoot });
	const artifactPath = writePlanArtifact({ projectRoot, plan });

	if (json) {
		return { plan, artifactPath, output: JSON.stringify(plan, null, 2) };
	}

	return { plan, artifactPath, output: formatPlanHuman(plan) };
}

async function main() {
	const argv = process.argv.slice(2);
	const json = argv.includes('--json');
	const scope = argv.filter((a) => !a.startsWith('--')).join(' ') || 'all';

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

const __filename = fileURLToPath(import.meta.url);
const isMainModule =
	process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
	main();
}
