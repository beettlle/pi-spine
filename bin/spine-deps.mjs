#!/usr/bin/env node
/**
 * spine deps
 *
 * Inspect task dependency graph without running a full batch plan.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadSpineConfig } from './spine-config.mjs';
import { buildDepsReport, formatDepsHuman } from '../src/cli/deps.mjs';

export async function runSpineDeps({
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

	const report = buildDepsReport({
		projectRoot,
		scope,
		config: configResult.config,
	});

	if (json) {
		return {
			report,
			exitCode: report.cycles.length > 0 ? 1 : 0,
			output: JSON.stringify(report, null, 2) + '\n',
		};
	}

	return {
		report,
		exitCode: report.cycles.length > 0 ? 1 : 0,
		output: formatDepsHuman(report),
	};
}

async function main() {
	const argv = process.argv.slice(2);
	const json = argv.includes('--json');
	const scope = argv.filter((a) => !a.startsWith('--')).join(' ') || 'all';

	try {
		const { output, exitCode } = await runSpineDeps({ projectRoot: process.cwd(), scope, json });
		process.stdout.write(output);
		if (exitCode !== 0) process.exit(exitCode);
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
