/**
 * spine settings show — read-only display of editable spine-config fields (FR-CFG-03).
 */

import {
	formatConfigSourceDetail,
	getValueAtPath as getConfigValueAtPath,
	listEnvAwareDisplayFields,
} from "../config/env-overrides.mjs";
import { listEditableFields, parseSettingPath } from "../config/settings-fields.mjs";

/**
 * @param {unknown} config
 * @param {string} dottedPath
 * @returns {unknown}
 */
export function getValueAtPath(config, dottedPath) {
	return getConfigValueAtPath(config, dottedPath);
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
 * @param {Record<string, import("../config/env-overrides.mjs").ConfigValueSource>} [sources]
 * @param {Record<string, string>} [envVars]
 */
export function buildEnvAwareShowFields(config, sources, envVars) {
	return listEnvAwareDisplayFields().map((field) => ({
		path: field.path,
		label: field.label,
		value: getValueAtPath(config, field.path),
		type: field.type,
		source: sources?.[field.path] ?? "file",
		envVar: envVars?.[field.path],
		detail: formatConfigSourceDetail(sources, envVars, field.path, getValueAtPath(config, field.path)),
	}));
}

/**
 * @param {object} config
 * @param {{ path?: string, json?: boolean, sources?: Record<string, string>, envVars?: Record<string, string> }} [options]
 * @returns {{ exitCode: number, output: string, error?: string, suggestedCommand?: string }}
 */
export function formatSettingsShow(config, { path, json = false, sources, envVars } = {}) {
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
		const source = sources?.[parsed.path];
		const envVar = envVars?.[parsed.path];
		if (json) {
			return {
				exitCode: 0,
				output: `${JSON.stringify({ path: parsed.path, value, source, envVar }, null, 2)}\n`,
			};
		}

		const suffix =
			source === "env" && envVar ? ` (${source}: ${envVar})` : source ? ` (${source})` : "";
		return {
			exitCode: 0,
			output: `${formatSettingValue(value, parsed.field.type)}${suffix}\n`,
		};
	}

	const envAwareFields = buildEnvAwareShowFields(config, sources, envVars);
	const fields = buildSettingsShowFields(config);
	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ envAwareFields, fields }, null, 2)}\n`,
		};
	}

	const lines = ["", "Effective config (env > file)", ""];
	for (const field of envAwareFields) {
		lines.push(`${field.path.padEnd(28)} ${field.label}: ${field.detail}`);
	}
	lines.push("", "Spine settings (editable via settings set)", "");
	for (const field of fields) {
		const source = sources?.[field.path];
		const envVar = envVars?.[field.path];
		const suffix =
			source === "env" && envVar ? ` (${source}: ${envVar})` : source ? ` (${source})` : "";
		lines.push(
			`${field.path.padEnd(28)} ${field.label}: ${formatSettingValue(field.value, field.type)}${suffix}`,
		);
	}
	lines.push("");

	return {
		exitCode: 0,
		output: lines.join("\n"),
	};
}
