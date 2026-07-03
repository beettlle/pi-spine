/**
 * spine settings set — validate, merge, and persist editable spine-config fields (FR-CFG-03).
 */

import path from "node:path";

import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { normalizeModelId } from "../config/model-id.mjs";
import { parseSettingPath, validateSettingValue } from "../config/settings-fields.mjs";
import { validateSpineConfig } from "../config/spine-config-load.mjs";
import { getValueAtPath } from "./settings-show.mjs";

const MODEL_FIELD_PATHS = new Set([
	"agents.worker.model",
	"agents.reviewer.model",
	"agents.reviewer.plan.model",
	"agents.reviewer.code.model",
	"agents.reviewer.final.model",
]);

/**
 * @param {object} config
 * @param {string} dottedPath
 * @param {boolean | number | string} value
 * @returns {object}
 */
export function applySetting(config, dottedPath, value) {
	const parts = dottedPath.split(".");
	const next = structuredClone(config);
	let current = next;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		const existing = current[part];
		if (existing == null || typeof existing !== "object" || Array.isArray(existing)) {
			current[part] = {};
		}
		current = /** @type {Record<string, unknown>} */ (current[part]);
	}

	current[parts[parts.length - 1]] = value;
	return next;
}

/**
 * @param {string} projectRoot
 * @param {object} config
 */
export function writeSpineConfigAtomic(projectRoot, config) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	writeJsonAtomic(configPath, config);
}

/**
 * @param {object} config
 * @param {{ path: string, rawValue: unknown, dryRun?: boolean, json?: boolean }} options
 * @returns {{
 *   exitCode: number,
 *   output: string,
 *   error?: string,
 *   suggestedCommand?: string,
 *   path?: string,
 *   previousValue?: unknown,
 *   newValue?: boolean | number | string,
 *   config?: object,
 *   dryRun?: boolean,
 *   wrote?: boolean,
 * }}
 */
export function runSettingsSetOperation(config, { path, rawValue, dryRun = false, json = false }) {
	const parsed = parseSettingPath(path);
	if (!parsed.ok) {
		const message = parsed.error;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ error: message }, null, 2)}\n`,
				error: message,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\n`,
			error: message,
		};
	}

	const validated = validateSettingValue(path, rawValue);
	if (!validated.ok) {
		const message = validated.error;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ error: message }, null, 2)}\n`,
				error: message,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\n`,
			error: message,
		};
	}

	let settingValue = validated.normalizedValue;
	if (MODEL_FIELD_PATHS.has(parsed.path) && typeof settingValue === "string" && settingValue !== "") {
		const modelResult = normalizeModelId(settingValue);
		if (!modelResult.ok) {
			const message = modelResult.error;
			if (json) {
				return {
					exitCode: 1,
					output: `${JSON.stringify({ error: message }, null, 2)}\n`,
					error: message,
				};
			}
			return {
				exitCode: 1,
				output: `Error: ${message}\n`,
				error: message,
			};
		}
		settingValue = modelResult.value;
	}

	const previousValue = getValueAtPath(config, parsed.path);
	const nextConfig = applySetting(config, parsed.path, settingValue);
	const validationError = validateSpineConfig(nextConfig);
	if (validationError) {
		const message = validationError.message;
		if (json) {
			return {
				exitCode: 1,
				output: `${JSON.stringify({ error: message, suggestedCommand: validationError.suggestedCommand }, null, 2)}\n`,
				error: message,
				suggestedCommand: validationError.suggestedCommand,
			};
		}
		return {
			exitCode: 1,
			output: `Error: ${message}\nSuggested: ${validationError.suggestedCommand}\n`,
			error: message,
			suggestedCommand: validationError.suggestedCommand,
		};
	}

	const wrote = !dryRun;
	const payload = {
		path: parsed.path,
		previousValue,
		newValue: settingValue,
		dryRun,
		wrote,
	};

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify(payload, null, 2)}\n`,
			...payload,
			config: nextConfig,
		};
	}

	return {
		exitCode: 0,
		output: `Updated ${parsed.path}: ${formatValue(previousValue)} → ${formatValue(settingValue)}${dryRun ? " (dry run)" : ""}\n`,
		...payload,
		config: nextConfig,
	};
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value) {
	if (value === undefined || value === null) {
		return "(not set)";
	}
	return String(value);
}
