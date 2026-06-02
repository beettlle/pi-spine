/**
 * FR-CFG-04 environment variable overrides (TP-046).
 * Precedence: env > file > defaults (applied in loadSpineConfig after file parse).
 */

import path from "node:path";

import { validateSettingValue } from "./settings-fields.mjs";

/** @typedef {"file" | "env" | "default"} ConfigValueSource */

/**
 * @typedef {object} EnvOverrideSpec
 * @property {string} envVar
 * @property {string} configPath Dotted path (e.g. paths.tasksRoot)
 * @property {"tasksRoot" | "maxParallel"} kind
 */

/** @type {readonly EnvOverrideSpec[]} */
export const ENV_OVERRIDE_SPECS = Object.freeze([
	{ envVar: "SPINE_TASKS_ROOT", configPath: "paths.tasksRoot", kind: "tasksRoot" },
	{ envVar: "SPINE_MAX_LANES", configPath: "lanes.maxParallel", kind: "maxParallel" },
]);

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
 * @param {object} config
 * @param {string} dottedPath
 * @param {unknown} value
 */
export function setValueAtPath(config, dottedPath, value) {
	const parts = dottedPath.split(".");
	let current = /** @type {Record<string, unknown>} */ (config);
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		const next = current[part];
		if (next == null || typeof next !== "object" || Array.isArray(next)) {
			current[part] = {};
		}
		current = /** @type {Record<string, unknown>} */ (current[part]);
	}
	current[parts[parts.length - 1]] = value;
}

/**
 * Normalize SPINE_TASKS_ROOT for storage in paths.tasksRoot.
 * Absolute paths are stored as-is; relative paths are normalized like init --tasks-root.
 *
 * @param {string} raw
 * @param {string} projectRoot
 * @returns {{ ok: true, normalized: string } | { ok: false, error: string }}
 */
export function normalizeTasksRootFromEnv(raw, _projectRoot) {
	const trimmed = raw.trim();
	if (trimmed === "") {
		return { ok: false, error: "SPINE_TASKS_ROOT must be a non-empty path" };
	}

	if (path.isAbsolute(trimmed)) {
		return { ok: true, normalized: path.normalize(trimmed) };
	}

	const normalized = trimmed
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "")
		.replace(/\/+$/, "");

	if (!normalized || normalized === ".") {
		return { ok: false, error: "SPINE_TASKS_ROOT must not be empty" };
	}
	if (normalized === ".." || normalized.startsWith("../")) {
		return {
			ok: false,
			error: "SPINE_TASKS_ROOT must stay within the project root (paths starting with .. are not allowed)",
		};
	}

	return { ok: true, normalized };
}

/**
 * @param {string} projectRoot
 * @param {object} config Effective config (paths.tasksRoot set)
 * @returns {string|null}
 */
export function resolveTasksRootPath(projectRoot, config) {
	const tasksRoot = config?.paths?.tasksRoot;
	if (typeof tasksRoot !== "string" || tasksRoot.trim() === "") {
		return null;
	}
	if (path.isAbsolute(tasksRoot)) {
		return path.normalize(tasksRoot);
	}
	return path.join(projectRoot, tasksRoot);
}

/**
 * @param {object} config Loaded file config (validated)
 * @param {string} projectRoot
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   ok: true,
 *   config: object,
 *   sources: Record<string, ConfigValueSource>,
 *   envVars: Record<string, string>,
 * } | { ok: false, error: { code: string, message: string, suggestedCommand?: string } }}
 */
export function applyEnvOverrides(config, projectRoot, env = process.env) {
	/** @type {Record<string, ConfigValueSource>} */
	const sources = {};
	/** @type {Record<string, string>} */
	const envVars = {};

	for (const spec of ENV_OVERRIDE_SPECS) {
		sources[spec.configPath] = "file";
	}

	const merged = structuredClone(config);

	for (const spec of ENV_OVERRIDE_SPECS) {
		const raw = env[spec.envVar];
		if (raw == null || String(raw).trim() === "") {
			continue;
		}

		if (spec.kind === "tasksRoot") {
			const parsed = normalizeTasksRootFromEnv(String(raw), projectRoot);
			if (!parsed.ok) {
				return {
					ok: false,
					error: {
						code: "CONFIG_ENV_INVALID",
						message: parsed.error,
						suggestedCommand: "unset SPINE_TASKS_ROOT",
					},
				};
			}
			setValueAtPath(merged, spec.configPath, parsed.normalized);
			sources[spec.configPath] = "env";
			envVars[spec.configPath] = spec.envVar;
			continue;
		}

		if (spec.kind === "maxParallel") {
			const validated = validateSettingValue("lanes.maxParallel", raw);
			if (!validated.ok) {
				return {
					ok: false,
					error: {
						code: "CONFIG_ENV_INVALID",
						message: `SPINE_MAX_LANES: ${validated.error}`,
						suggestedCommand: "unset SPINE_MAX_LANES",
					},
				};
			}
			setValueAtPath(merged, spec.configPath, validated.normalizedValue);
			sources[spec.configPath] = "env";
			envVars[spec.configPath] = spec.envVar;
		}
	}

	return { ok: true, config: merged, sources, envVars };
}

/**
 * Display fields for settings show / doctor (env-overridable + effective value).
 *
 * @returns {{ path: string, label: string, type: string }[]}
 */
export function listEnvAwareDisplayFields() {
	return [
		{ path: "paths.tasksRoot", label: "Tasks root (relative or absolute)", type: "string" },
		{ path: "lanes.maxParallel", label: "Max parallel lanes", type: "number" },
	];
}

/**
 * @param {Record<string, ConfigValueSource> | undefined} sources
 * @param {Record<string, string> | undefined} envVars
 * @param {string} configPath
 * @param {unknown} value
 * @returns {string}
 */
export function formatConfigSourceDetail(sources, envVars, configPath, value) {
	const display = value === undefined || value === null ? "(not set)" : String(value);
	const source = sources?.[configPath] ?? "file";
	if (source === "env" && envVars?.[configPath]) {
		return `${display} (source: env, ${envVars[configPath]})`;
	}
	return `${display} (source: ${source})`;
}
