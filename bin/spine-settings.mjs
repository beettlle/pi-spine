#!/usr/bin/env node
/**
 * spine settings
 *
 * Read and write commands for editable spine-config fields (FR-CFG-03).
 * Usage:
 *   spine settings show [path] [--json]
 *   spine settings set <path> <value> [--dry-run] [--json]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadSpineConfig } from "./spine-config.mjs";
import { formatSettingsShow } from "../src/cli/settings-show.mjs";
import {
	runSettingsSetOperation,
	writeSpineConfigAtomic,
} from "../src/cli/settings-set.mjs";

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
export function runSpineSettingsSet({ projectRoot, args }) {
	const json = args.includes("--json");
	const dryRun = args.includes("--dry-run");
	const positional = args.filter((arg) => !arg.startsWith("--"));

	if (positional.length < 2) {
		const message = "Usage: spine settings set <path> <value> [--dry-run] [--json]";
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ error: message }, null, 2)}\n`,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\n`,
		};
	}

	const [settingPath, ...valueParts] = positional;
	const rawValue = valueParts.join(" ");

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

	const result = runSettingsSetOperation(configResult.config, {
		path: settingPath,
		rawValue,
		dryRun,
		json,
	});

	if (result.exitCode !== 0) {
		return result;
	}

	if (!dryRun && result.config) {
		writeSpineConfigAtomic(projectRoot, result.config);
	}

	return result;
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

	if (sub === "set") {
		return runSpineSettingsSet({ projectRoot, args: args.slice(1) });
	}

	return {
		exitCode: 1,
		output: `Error: Unknown settings subcommand: ${sub}\nRun spine settings show [path] [--json] or spine settings set <path> <value> for usage.\n`,
	};
}

function printSettingsHelp() {
	console.log(`
Usage:
  spine settings show [path] [--json]
  spine settings set <path> <value> [--dry-run] [--json]

Show editable spine-config fields and their current values.
With path, print a single registered setting value.

Set updates one registered field after validation; use --dry-run to preview without writing.
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
