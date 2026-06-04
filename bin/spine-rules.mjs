#!/usr/bin/env node
/**
 * spine rules — discover, select, and sync Cursor rules manifest (SP-093).
 *
 * Usage:
 *   spine rules discover [--json]
 *   spine rules select --task <task-id> [--json]
 *   spine rules sync [--json]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { printRulesHelp, runSpineRules } from "../src/cli/rules.mjs";

export { printRulesHelp, runSpineRules } from "../src/cli/rules.mjs";

async function main() {
	const argv = process.argv.slice(2);

	if (argv.includes("--help") || argv.includes("-h")) {
		process.stdout.write(printRulesHelp());
		return;
	}

	const result = runSpineRules({ projectRoot: process.cwd(), args: argv });
	process.stdout.write(result.output ?? "");
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
