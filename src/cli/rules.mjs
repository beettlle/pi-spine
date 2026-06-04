/**
 * spine rules discover | select | sync (SP-093).
 */

import fs from "node:fs";

import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import {
	discoverCursorRules,
	loadRulesManifest,
	RULES_MANIFEST_REL_PATH,
} from "../config/cursor-rules/discover.mjs";
import { loadRulesProfile, RULES_PROFILE_REL_PATH } from "../config/cursor-rules/profile.mjs";
import { selectRulesForWorker } from "../config/cursor-rules/select.mjs";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { parsePrompt } from "../tasks/packet/parse-prompt.mjs";

/**
 * @param {string[]} argv
 */
export function parseRulesArgv(argv) {
	const json = argv.includes("--json");
	const taskIdx = argv.indexOf("--task");
	const taskId = taskIdx !== -1 ? argv[taskIdx + 1] : undefined;
	if (taskIdx !== -1 && (!taskId || taskId.startsWith("--"))) {
		throw new Error("Missing value for --task <task-id>.");
	}
	return { json, taskId };
}

/**
 * @param {import("../config/cursor-rules/discover.mjs").DiscoverCursorRulesResult} result
 */
export function formatRulesDiscoverHuman(result) {
	const { manifest, manifestPath } = result;
	const summary = `${manifest.rules.length} rules, ${manifest.excluded.length} excluded`;
	const warningNote =
		manifest.warnings?.length > 0 ? ` (${manifest.warnings.length} warning(s))` : "";
	const pathNote = manifestPath ? `\n  wrote ${RULES_MANIFEST_REL_PATH}` : "";
	return `Discovered ${summary}${warningNote}.${pathNote}\n`;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.json]
 * @param {boolean} [params.writeManifest]
 */
export function runRulesDiscover({ projectRoot, json = false, writeManifest = true }) {
	const profileResult = loadRulesProfile(projectRoot);
	if (!profileResult.ok) {
		const message = profileResult.error.message;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: message, code: profileResult.error.code }, null, 2)}\n`,
			};
		}
		return { exitCode: 1, output: `Error: ${message}\n` };
	}

	const result = discoverCursorRules({
		projectRoot,
		profile: profileResult.profile,
		writeManifest,
	});

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify(result, null, 2)}\n`,
			result,
		};
	}

	return {
		exitCode: 0,
		output: formatRulesDiscoverHuman(result),
		result,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.json]
 */
export function runRulesSync({ projectRoot, json = false }) {
	return runRulesDiscover({ projectRoot, json, writeManifest: true });
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 */
export function resolveTaskPromptFileScope(tasksRoot, taskId) {
	const match = discoverTasks(tasksRoot).find((task) => task.taskId === taskId);
	if (!match) {
		return {
			ok: false,
			error: `Task not found: ${taskId}`,
			suggestedCommand: "spine deps all",
		};
	}

	const markdown = fs.readFileSync(match.promptPath, "utf-8");
	const prompt = parsePrompt(markdown);
	if (!prompt.taskId) {
		return {
			ok: false,
			error: `Invalid PROMPT.md in ${match.folderName}`,
		};
	}

	return {
		ok: true,
		taskId: prompt.taskId,
		folderName: match.folderName,
		fileScope: prompt.fileScope,
	};
}

/**
 * @param {import("../config/cursor-rules/select.mjs").RulesSelectionResult} selection
 * @param {object} meta
 */
export function formatRulesSelectHuman(selection, meta) {
	const lines = [
		`Task ${meta.taskId} (${meta.folderName})`,
		`  file scope: ${meta.fileScope.length} path(s)`,
		`  selected: ${selection.paths.length} rule(s)`,
	];
	if (selection.capped && selection.dropped?.length) {
		lines.push(`  capped: dropped ${selection.dropped.length} lower-priority rule(s)`);
	}
	for (const entry of selection.entries) {
		lines.push(`  - ${entry.contextPath} (${entry.source})`);
	}
	return `${lines.join("\n")}\n`;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskId
 * @param {boolean} [params.json]
 */
export function runRulesSelect({ projectRoot, taskId, json = false }) {
	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		const message = configResult.error.message;
		const suggestedCommand = configResult.error.suggestedCommand;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: message, suggestedCommand }, null, 2)}\n`,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\nSuggested: ${suggestedCommand}\n`,
		};
	}

	const tasksRoot = resolveTasksRootPath(projectRoot, configResult.config);
	const scopeResult = resolveTaskPromptFileScope(tasksRoot, taskId);
	if (!scopeResult.ok) {
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: scopeResult.error, suggestedCommand: scopeResult.suggestedCommand }, null, 2)}\n`,
			};
		}
		const hint = scopeResult.suggestedCommand ? `\nSuggested: ${scopeResult.suggestedCommand}` : "";
		return { exitCode: 1, output: `Error: ${scopeResult.error}${hint}\n` };
	}

	const profileResult = loadRulesProfile(projectRoot);
	if (!profileResult.ok) {
		const message = profileResult.error.message;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: message, code: profileResult.error.code }, null, 2)}\n`,
			};
		}
		return { exitCode: 1, output: `Error: ${message}\n` };
	}

	const manifest = loadRulesManifest(projectRoot);
	if (!manifest) {
		const message = `${RULES_MANIFEST_REL_PATH} missing — run spine rules sync`;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: message, suggestedCommand: "spine rules sync" }, null, 2)}\n`,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\n`,
			suggestedCommand: "spine rules sync",
		};
	}

	const standards = Array.isArray(configResult.config.standards) ? configResult.config.standards : [];
	const neverLoad = Array.isArray(configResult.config.neverLoad) ? configResult.config.neverLoad : [];

	const selection = selectRulesForWorker({
		manifest,
		profile: profileResult.profile,
		fileScope: scopeResult.fileScope,
		standards,
		neverLoad,
	});

	const payload = {
		ok: true,
		taskId: scopeResult.taskId,
		folderName: scopeResult.folderName,
		fileScope: scopeResult.fileScope,
		selection,
	};

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify(payload, null, 2)}\n`,
			selection,
		};
	}

	return {
		exitCode: 0,
		output: formatRulesSelectHuman(selection, scopeResult),
		selection,
	};
}

export function printRulesHelp() {
	return `
Usage:
  spine rules discover [--json]
  spine rules select --task <task-id> [--json]
  spine rules sync [--json]

Discover scans .cursor/rules and writes .spine/rules-manifest.json (committed to git).
Select previews worker rule selection for a task PROMPT File Scope (append semantics for config.standards).
Sync re-runs discovery and updates the committed manifest.

Files:
  ${RULES_PROFILE_REL_PATH}   Worker/discovery profile (copied by spine init)
  ${RULES_MANIFEST_REL_PATH}  Committed discovery manifest

Examples:
  spine rules discover
  spine rules discover --json
  spine rules select --task SP-093
  spine rules sync
`;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineRules({ projectRoot, args }) {
	if (args.includes("--help") || args.includes("-h") || args.length === 0) {
		return { exitCode: 0, output: printRulesHelp() };
	}

	const sub = args[0];
	const rest = args.slice(1);

	try {
		const { json, taskId } = parseRulesArgv(rest);

		if (sub === "discover") {
			return runRulesDiscover({ projectRoot, json, writeManifest: true });
		}
		if (sub === "sync") {
			return runRulesSync({ projectRoot, json });
		}
		if (sub === "select") {
			if (!taskId) {
				return {
					exitCode: 1,
					output: "Error: spine rules select requires --task <task-id>\n",
				};
			}
			return runRulesSelect({ projectRoot, taskId, json });
		}

		return {
			exitCode: 1,
			output: `Error: Unknown rules subcommand: ${sub}\n${printRulesHelp()}`,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (rest.includes("--json")) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ ok: false, error: message }, null, 2)}\n`,
			};
		}
		return { exitCode: 1, output: `Error: ${message}\n` };
	}
}
