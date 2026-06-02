#!/usr/bin/env node
/**
 * spine settings
 *
 * Read-only and write commands for editable spine-config fields (FR-CFG-03).
 * Usage: spine settings show [path] [--json]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSpineConfig } from "./spine-config.mjs";
import { formatSettingsShow } from "../src/cli/settings-show.mjs";

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineSettingsShow({ projectRoot, args }) {
	const json = args.includes("--json");
	const settingPath = args.find((arg) => !arg.startsWith("--")) ?? undefined;

	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		const message = configResult.error.message;
		const suggestedCommand = configResult.error.suggestedCommand;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ error: message, suggestedCommand }, null, 2)}\n`,
				suggestedCommand,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\nSuggested: ${suggestedCommand}\n`,
			suggestedCommand,
		};
	}

	return formatSettingsShow(configResult.config, { path: settingPath, json });
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineSettings({ projectRoot, args }) {
	const sub = args[0];

	if (sub === "show" || sub === undefined) {
		const showArgs = sub === "show" ? args.slice(1) : args;
		return runSpineSettingsShow({ projectRoot, args: showArgs });
	}

	return {
		exitCode: 1,
		output: `Error: Unknown settings subcommand: ${sub}\nRun spine settings show [path] [--json] for usage.\n`,
	};
}

function printSettingsHelp() {
	console.log(`
Usage:
  spine settings show [path] [--json]

Show editable spine-config fields and their current values.
With path, print a single registered setting value.
`);
}

async function main() {
	const argv = process.argv.slice(2);

	if (argv.includes("--help") || argv.includes("-h")) {
		printSettingsHelp();
		return;
	}

	const result = runSpineSettings({ projectRoot: process.cwd(), args: argv });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) {
		process.exit(result.exitCode);
	}
}

const __filename = fileURLToPath(import.meta.url);
const isMainModule =
	process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMainModule) {
	main();
}
