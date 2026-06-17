/**
 * spine rules discover | select | sync (SP-093).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import {
	discoverCursorRules,
	loadRulesManifest,
	RULES_MANIFEST_REL_PATH,
} from "../config/cursor-rules/discover.mjs";
import { loadRulesProfile, RULES_PROFILE_REL_PATH } from "../config/cursor-rules/profile.mjs";
import { selectRulesForReviewer, selectRulesForWorker } from "../config/cursor-rules/select.mjs";
import { resolveReviewScopePaths } from "../batch/review-scope.mjs";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { loadTaskPacket } from "../tasks/packet/index.mjs";

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

	const roleIdx = argv.indexOf("--role");
	let role = "worker";
	if (roleIdx !== -1) {
		const roleValue = argv[roleIdx + 1];
		if (!roleValue || roleValue.startsWith("--")) {
			throw new Error("Missing value for --role <worker|reviewer>.");
		}
		if (roleValue !== "worker" && roleValue !== "reviewer") {
			throw new Error(`Invalid --role: ${roleValue}. Use worker or reviewer.`);
		}
		role = roleValue;
	}

	const reviewTypeIdx = argv.indexOf("--review-type");
	let reviewType;
	if (reviewTypeIdx !== -1) {
		const reviewTypeValue = argv[reviewTypeIdx + 1];
		if (!reviewTypeValue || reviewTypeValue.startsWith("--")) {
			throw new Error("Missing value for --review-type <plan|code|final>.");
		}
		if (!["plan", "code", "final"].includes(reviewTypeValue)) {
			throw new Error(`Invalid --review-type: ${reviewTypeValue}. Use plan, code, or final.`);
		}
		reviewType = reviewTypeValue;
	}

	const baselineIdx = argv.indexOf("--baseline");
	let baseline;
	if (baselineIdx !== -1) {
		const baselineValue = argv[baselineIdx + 1];
		if (!baselineValue || baselineValue.startsWith("--")) {
			throw new Error("Missing value for --baseline <sha>.");
		}
		baseline = baselineValue;
	}

	if (role === "reviewer" && !reviewType) {
		throw new Error("spine rules select --role reviewer requires --review-type <plan|code|final>.");
	}
	if (role === "worker" && reviewType) {
		throw new Error("spine rules select --review-type is only valid with --role reviewer.");
	}
	if (baseline && role !== "reviewer") {
		throw new Error("spine rules select --baseline is only valid with --role reviewer.");
	}

	return { json, taskId, role, reviewType, baseline };
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

	const packet = loadTaskPacket(match.folderPath);
	if (!packet.validation.ok) {
		return {
			ok: false,
			error: packet.validation.errors.join("; "),
			errors: packet.validation.errors,
			promptPath: packet.promptPath,
		};
	}

	const prompt = packet.prompt;
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
		folderPath: match.folderPath,
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
	];
	if (meta.role === "reviewer") {
		lines.push(`  role: reviewer (${meta.reviewType})`);
		lines.push(`  scope paths: ${meta.scopePaths.length} path(s)`);
	} else {
		lines.push(`  file scope: ${meta.fileScope.length} path(s)`);
	}
	lines.push(`  selected: ${selection.paths.length} rule(s)`);
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
 * @param {"worker"|"reviewer"} [params.role]
 * @param {"plan"|"code"|"final"} [params.reviewType]
 * @param {string} [params.baseline]
 */
export function runRulesSelect({
	projectRoot,
	taskId,
	json = false,
	role = "worker",
	reviewType,
	baseline,
}) {
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

	/** @type {import("../config/cursor-rules/select.mjs").RulesSelectionResult} */
	let selection;
	/** @type {string[]} */
	let scopePaths = scopeResult.fileScope;

	if (role === "reviewer") {
		const scopeResolution = resolveReviewScopePaths({
			worktreePath: projectRoot,
			baseline,
			reviewType: /** @type {"plan"|"code"|"final"} */ (reviewType),
			taskFolder: scopeResult.folderPath,
		});
		scopePaths = scopeResolution.scopePaths;
		selection = selectRulesForReviewer({
			manifest,
			profile: profileResult.profile,
			scopePaths,
			standards,
			neverLoad,
		});
	} else {
		selection = selectRulesForWorker({
			manifest,
			profile: profileResult.profile,
			fileScope: scopeResult.fileScope,
			standards,
			neverLoad,
		});
	}

	const payload =
		role === "reviewer"
			? {
					ok: true,
					role: "reviewer",
					reviewType,
					taskId: scopeResult.taskId,
					folderName: scopeResult.folderName,
					scopePaths,
					selection,
				}
			: {
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

	const meta =
		role === "reviewer"
			? {
					taskId: scopeResult.taskId,
					folderName: scopeResult.folderName,
					role: "reviewer",
					reviewType,
					scopePaths,
				}
			: scopeResult;

	return {
		exitCode: 0,
		output: formatRulesSelectHuman(selection, meta),
		selection,
	};
}

export function printRulesHelp() {
	return `
Usage:
  spine rules discover [--json]
  spine rules select --task <task-id> [--role worker|reviewer] [--review-type plan|code|final] [--baseline <sha>] [--json]
  spine rules sync [--json]

Discover scans .cursor/rules and writes .spine/rules-manifest.json (committed to git).
Select previews rule selection for a task. Default role is worker (PROMPT File Scope).
Reviewer role resolves review-type-specific scope paths and uses profile.reviewer.
Sync re-runs discovery and updates the committed manifest.

Files:
  ${RULES_PROFILE_REL_PATH}   Worker/discovery profile (copied by spine init)
  ${RULES_MANIFEST_REL_PATH}  Committed discovery manifest

Examples:
  spine rules discover
  spine rules discover --json
  spine rules select --task SP-093
  spine rules select --task SP-093 --role reviewer --review-type plan
  spine rules select --task SP-093 --role reviewer --review-type code --baseline abc1234
  spine rules select --task SP-093 --role reviewer --review-type final --json
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
		const { json, taskId, role, reviewType, baseline } = parseRulesArgv(rest);

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
			return runRulesSelect({ projectRoot, taskId, json, role, reviewType, baseline });
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
