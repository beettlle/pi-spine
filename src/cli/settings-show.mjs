/**
 * spine settings show — read-only display of editable spine-config fields (FR-CFG-03).
 */

import { listEditableFields, parseSettingPath } from "../config/settings-fields.mjs";

/**
 * @param {unknown} config
 * @param {string} dottedPath
 * @returns {unknown}
 */
export function getValueAtPath(config, dottedPath) {
	const parts = dottedPath.split(".");
	let current = config;
	for (const part of parts) {
		if (current == null || typeof current !== "object") {
			return undefined;
		}
		current = /** @type {Record<string, unknown>} */ (current)[part];
	}
	return current;
}

/**
 * @param {unknown} value
 * @param {string} type
 * @returns {string}
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
 * @returns {{ path: string, label: string, value: unknown, type: string }[]}
 */
export function buildSettingsShowFields(config) {
	return listEditableFields().map((field) => ({
		path: field.path,
		label: field.label,
		value: getValueAtPath(config, field.path),
		type: field.type,
	}));
}

/**
 * @param {object} config
 * @param {{ path?: string, json?: boolean }} [options]
 * @returns {{ exitCode: number, output: string, error?: string, suggestedCommand?: string }}
 */
export function formatSettingsShow(config, { path, json = false } = {}) {
	if (path) {
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

		const value = getValueAtPath(config, parsed.path);
		if (json) {
			return {
				exitCode: 0,
				output: `${JSON.stringify({ path: parsed.path, value }, null, 2)}\n`,
			};
		}

		return {
			exitCode: 0,
			output: `${formatSettingValue(value, parsed.field.type)}\n`,
		};
	}

	const fields = buildSettingsShowFields(config);
	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ fields }, null, 2)}\n`,
		};
	}

	const lines = ["", "Spine settings", ""];
	for (const field of fields) {
		lines.push(
			`${field.path.padEnd(28)} ${field.label}: ${formatSettingValue(field.value, field.type)}`,
		);
	}
	lines.push("");

	return {
		exitCode: 0,
		output: lines.join("\n"),
	};
}
