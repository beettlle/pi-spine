import fs from "node:fs";
import path from "node:path";

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

export function loadSpineConfig(projectRoot) {
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
			suggestedCommand: "spine init --tasks-root taskplane-tasks",
		};
	}

	if (typeof config.lanes?.maxParallel !== "number" || config.lanes.maxParallel < 1) {
		return {
			code: "CONFIG_LANES_INVALID",
			message: "lanes.maxParallel must be a number >= 1",
			suggestedCommand: "/spine-settings",
		};
	}

	return null;
}
