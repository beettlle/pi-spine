import fs from "node:fs";
import path from "node:path";

import { applyEnvOverrides } from "../src/config/env-overrides.mjs";
import { validateWorkerBackendConfig } from "../src/config/worker-backend.mjs";
import { validateWorkerContextConfig } from "../src/config/worker-context.mjs";
import { validateWorkerLaunchScriptConfig } from "../src/config/worker-launch-script.mjs";

const REQUIRED_TOP_LEVEL = [
	"configVersion",
	"project",
	"paths",
	"baseBranch",
	"testing",
	"agents",
	"lanes",
	"gates",
];

/**
 * Load spine-config.json from disk only (no FR-CFG-04 env overrides).
 * Use for persistence paths (e.g. settings set) so env values are not written to file.
 */
export function loadSpineConfigFile(projectRoot) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");

	if (!fs.existsSync(configPath)) {
		return {
			configPath,
			config: null,
			error: {
				code: "CONFIG_MISSING",
				message: ".spine/spine-config.json not found",
				suggestedCommand: "spine init",
			},
		};
	}

	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	} catch (err) {
		return {
			configPath,
			config: null,
			error: {
				code: "CONFIG_PARSE_ERROR",
				message: `Cannot parse spine config: ${err.message}`,
				suggestedCommand: "spine init --force",
			},
		};
	}

	const validationError = validateSpineConfig(parsed);
	if (validationError) {
		return {
			configPath,
			config: null,
			error: validationError,
		};
	}

	return {
		configPath,
		config: parsed,
		error: null,
	};
}

/**
 * Load config with FR-CFG-04 env overrides applied (precedence: env > file).
 */
export function loadSpineConfig(projectRoot) {
	const fileResult = loadSpineConfigFile(projectRoot);
	if (fileResult.error) {
		return fileResult;
	}

	const envResult = applyEnvOverrides(fileResult.config, projectRoot);
	if (!envResult.ok) {
		return {
			configPath: fileResult.configPath,
			config: null,
			error: envResult.error,
		};
	}

	return {
		configPath: fileResult.configPath,
		config: envResult.config,
		fileConfig: fileResult.config,
		sources: envResult.sources,
		envVars: envResult.envVars,
		error: null,
	};
}

export function validateSpineConfig(config) {
	if (typeof config !== "object" || config === null || Array.isArray(config)) {
		return {
			code: "CONFIG_SCHEMA_INVALID",
			message: "spine-config.json must be a JSON object",
			suggestedCommand: "spine init --force",
		};
	}

	if (config.configVersion !== 1) {
		return {
			code: "CONFIG_VERSION_UNSUPPORTED",
			message: `configVersion must be 1 (found ${config.configVersion ?? "missing"})`,
			suggestedCommand: "spine migrate-from-taskplane",
		};
	}

	for (const key of REQUIRED_TOP_LEVEL) {
		if (!(key in config)) {
			return {
				code: "CONFIG_SCHEMA_INVALID",
				message: `Missing required field: ${key}`,
				suggestedCommand: "spine init --force",
			};
		}
	}

	if (typeof config.paths?.tasksRoot !== "string" || config.paths.tasksRoot.trim() === "") {
		return {
			code: "CONFIG_TASKS_ROOT_INVALID",
			message: "paths.tasksRoot must be a non-empty string",
			suggestedCommand: "spine init",
		};
	}

	if (typeof config.lanes?.maxParallel !== "number" || config.lanes.maxParallel < 1) {
		return {
			code: "CONFIG_LANES_INVALID",
			message: "lanes.maxParallel must be a number >= 1",
			suggestedCommand: "/spine-settings",
		};
	}

	const workerBackendError = validateWorkerBackendConfig(config);
	if (workerBackendError) {
		return workerBackendError;
	}

	const workerContextError = validateWorkerContextConfig(config);
	if (workerContextError) {
		return workerContextError;
	}

	const launchScriptError = validateWorkerLaunchScriptConfig(config);
	if (launchScriptError) {
		return launchScriptError;
	}

	if (
		config.lanes?.autoCommitOnStall != null &&
		typeof config.lanes.autoCommitOnStall !== "boolean"
	) {
		return {
			code: "CONFIG_LANES_INVALID",
			message: "lanes.autoCommitOnStall must be a boolean when set",
			suggestedCommand: "spine settings set lanes.autoCommitOnStall false",
		};
	}

	return null;
}
