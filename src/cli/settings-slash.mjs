/**
 * /spine-settings menu formatter and handler (FR-CFG-03).
 */

import { loadSpineConfig, loadSpineConfigFile } from "../config/spine-config-load.mjs";
import { buildSettingsShowFields } from "./settings-show.mjs";
import { runSettingsSetOperation, writeSpineConfigAtomic } from "./settings-set.mjs";

/**
 * @param {unknown} value
 * @param {string} type
 */
function formatSettingValue(value, type) {
	if (value === undefined || value === null) {
		return "(not set)";
	}
	if (type === "boolean") {
		return value ? "true" : "false";
	}
	if (type === "string" && value === "") {
		return "(empty)";
	}
	return String(value);
}

/**
 * @param {object} config
 */
export function formatSettingsSlashMenu(config) {
	const fields = buildSettingsShowFields(config);
	const lines = ["Spine settings", ""];

	for (const field of fields) {
		const display = formatSettingValue(field.value, field.type);
		lines.push(`${field.path}`);
		lines.push(`  ${field.label}: ${display}`);
		lines.push(`  → spine settings set ${field.path} <value>`);
		lines.push("");
	}

	lines.push("Change from pi: /spine-settings set <path> <value>");
	lines.push("Read-only CLI: spine settings show [path] [--json]");

	return lines.join("\n");
}

/**
 * @param {string} argsText
 */
function parseSetArgs(argsText) {
	const tokens = argsText.trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0 || tokens[0] !== "set") {
		return { error: "Usage: /spine-settings set <path> <value>" };
	}

	const positional = tokens.slice(1);
	if (positional.length < 2) {
		return { error: "Usage: /spine-settings set <path> <value>" };
	}

	const [settingPath, ...valueParts] = positional;
	return { path: settingPath, rawValue: valueParts.join(" ") };
}

/**
 * @param {string} args
 * @param {{ notify: (message: string, level: string) => void }} ui
 * @param {string} [cwd]
 */
export async function runSpineSettingsSlash(args, ui, cwd = process.cwd()) {
	const trimmed = args.trim();

	if (trimmed === "set" || trimmed.startsWith("set ")) {
		const parsed = parseSetArgs(trimmed);
		if (parsed.error || !parsed.path || parsed.rawValue === undefined) {
			ui.notify(parsed.error ?? "Usage: /spine-settings set <path> <value>", "error");
			return;
		}

		const configResult = loadSpineConfigFile(cwd);
		if (configResult.error) {
			const suggested = configResult.error.suggestedCommand ?? "spine init";
			ui.notify(
				`${configResult.error.message}

→ ${suggested}`,
				"error",
			);
			return;
		}

		const result = runSettingsSetOperation(configResult.config, {
			path: parsed.path,
			rawValue: parsed.rawValue,
		});

		if (result.exitCode === 0 && result.config) {
			try {
				writeSpineConfigAtomic(cwd, result.config);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ui.notify(`Failed to write spine config: ${message}`, "error");
				return;
			}
		}

		if (result.exitCode !== 0) {
			ui.notify(result.output.trim() || "spine settings set failed", "error");
			return;
		}

		ui.notify(result.output.trim() || `Updated ${parsed.path}`, "info");
		return;
	}

	const configResult = loadSpineConfig(cwd);
	if (configResult.error) {
		const suggested = configResult.error.suggestedCommand ?? "spine init";
		ui.notify(
			`${configResult.error.message}

→ ${suggested}`,
			"error",
		);
		return;
	}

	ui.notify(formatSettingsSlashMenu(configResult.config), "info");
}
