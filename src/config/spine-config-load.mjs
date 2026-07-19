// @ts-check
import fs from "node:fs";
import path from "node:path";

import { applyEnvOverrides } from "./env-overrides.mjs";
import { applyConfigDefaults } from "./merge-defaults.mjs";
import { validateContractConfig } from "./contract.mjs";
import { resolveGatePostureConfig } from "./gate-posture-config.mjs";
import { validateWorkerBackendConfig } from "./worker-backend.mjs";
import { validateWorkerContextConfig } from "./worker-context.mjs";
import { validateWorkerLaunchScriptConfig } from "./worker-launch-script.mjs";
import { validateWorktreeSetupHookConfig } from "./worktree-setup-hook.mjs";
import { validateOrchestratorConfig, validateAgentProfilesConfig } from "./spine-config-schema.mjs";
import { missingConfigHint } from "./missing-config-hint.mjs";

export { resolveGatePostureConfig } from "./gate-posture-config.mjs";

/**
 * Default hook paths skipped at lane commit when config omits ignore paths (SP-640 / #200).
 * Worktree setup hooks commonly `ln -s` `.venv` into lane worktrees; do not stage that symlink.
 */
export const DEFAULT_WORKTREE_SETUP_IGNORE_PATHS = Object.freeze([".venv"]);

/**
 * Resolve effective `worktreeSetupIgnorePaths`, always unioning defaults so hook `.venv`
 * stays ignored. Opt in to committing an ignore path via task `fileScope`, not by clearing config.
 *
 * @param {Record<string, unknown> | null | undefined} config
 * @returns {string[]}
 */
export function resolveWorktreeSetupIgnorePaths(config) {
	const raw = config?.worktreeSetupIgnorePaths;
	const configured = Array.isArray(raw)
		? raw
				.filter((/** @type {unknown} */ entry) => typeof entry === "string" && entry.trim())
				.map((/** @type {unknown} */ entry) => /** @type {string} */ (entry).trim())
		: [];
	return [...new Set([...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS, ...configured])];
}

// --- Named agent model profile resolution (SP-664 / GitHub #216) ---

/** Agent sections that a named profile may override on top of the base agents config. */
const AGENT_SECTIONS = Object.freeze(["worker", "reviewer", "supervisor"]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `override` over `base` for a single agent section.
 *
 * Profile values win; base fills gaps. Recurses into plain objects so a profile's
 * nested reviewer `plan`/`code`/`final` pins merge without clobbering siblings
 * left at their base value.
 *
 * @param {unknown} base
 * @param {Record<string, unknown>} override
 * @returns {Record<string, unknown>}
 */
function deepMergeAgentSection(base, override) {
	const out = isPlainObject(base) ? structuredClone(base) : {};
	for (const [key, value] of Object.entries(override)) {
		if (isPlainObject(value) && isPlainObject(out[key])) {
			out[key] = deepMergeAgentSection(out[key], value);
		} else if (isPlainObject(value)) {
			out[key] = structuredClone(value);
		} else {
			out[key] = value;
		}
	}
	return out;
}

/**
 * Resolve the named active agent profile over the base `agents` config.
 *
 * Each profile mirrors the base `worker`/`reviewer`/`supervisor` shape. When
 * `agents.activeProfile` names a defined `agents.profiles` entry, that profile is
 * deep-merged over the base agents (profile wins, base fills gaps) so downstream
 * consumers — worker/reviewer/supervisor spawns and `spine doctor` — observe the
 * effective configuration rather than the raw base.
 *
 * Pure: returns a new config object and never mutates the input. No-op when no
 * active profile is set or the named profile does not exist.
 *
 * @param {Record<string, any>} config Effective config (defaults + env already applied).
 * @returns {Record<string, any>} Config with the active profile resolved into `agents`.
 */
export function applyActiveAgentProfile(config) {
	const result = structuredClone(config);
	const agents = result?.agents;
	if (!isPlainObject(agents)) return result;

	const active = agents.activeProfile;
	if (typeof active !== "string" || active.trim() === "") return result;

	const profiles = agents.profiles;
	if (!isPlainObject(profiles)) return result;

	const profile = profiles[active.trim()];
	if (!isPlainObject(profile)) return result;

	for (const section of AGENT_SECTIONS) {
		const override = profile[section];
		if (isPlainObject(override)) {
			agents[section] = deepMergeAgentSection(agents[section], override);
		}
	}
	return result;
}

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
 *
 * @param {string} projectRoot
 */
export function loadSpineConfigFile(projectRoot) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");

	if (!fs.existsSync(configPath)) {
		const hint = missingConfigHint(projectRoot);
		return {
			configPath,
			config: null,
			error: {
				code: "CONFIG_MISSING",
				message: hint.message,
				suggestedCommand: hint.suggestedCommand,
			},
		};
	}

	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			configPath,
			config: null,
			error: {
				code: "CONFIG_PARSE_ERROR",
				message: `Cannot parse spine config: ${message}`,
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
 *
 * @param {string} projectRoot
 */
export function loadSpineConfig(projectRoot) {
	const fileResult = loadSpineConfigFile(projectRoot);
	if (fileResult.error) {
		return fileResult;
	}

	const config = structuredClone(fileResult.config);
	applyConfigDefaults(config);
	if (config.worktreeSetupIgnorePaths == null) {
		config.worktreeSetupIgnorePaths = [...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS];
	}

	const contractError = validateContractConfig(config);
	if (contractError) {
		return {
			configPath: fileResult.configPath,
			config: null,
			error: contractError,
		};
	}

	const envResult = applyEnvOverrides(config, projectRoot);
	if (!envResult.ok) {
		return {
			configPath: fileResult.configPath,
			config: null,
			error: envResult.error,
		};
	}

	// Soft attach: posture merge fails closed inside the helper and never rejects load.
	const gatePostureConfig = resolveGatePostureConfig(envResult.config);

	// SP-664 / #216: resolve the named active agent profile over the base agents config
	// so spawns and doctor observe effective (base + profile) model pins.
	const resolvedConfig = applyActiveAgentProfile(envResult.config);

	return {
		configPath: fileResult.configPath,
		config: resolvedConfig,
		fileConfig: config,
		gatePostureConfig,
		sources: envResult.sources,
		envVars: envResult.envVars,
		error: null,
	};
}

/**
 * @param {Record<string, any>} config
 */
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

	const setupHookError = validateWorktreeSetupHookConfig(config);
	if (setupHookError) {
		return setupHookError;
	}

	const orchestratorError = validateOrchestratorConfig(config);
	if (orchestratorError) {
		return orchestratorError;
	}

	const profilesError = validateAgentProfilesConfig(config);
	if (profilesError) {
		return profilesError;
	}

	if (config.worktreeSetupIgnorePaths != null) {
		if (!Array.isArray(config.worktreeSetupIgnorePaths)) {
			return {
				code: "CONFIG_SETUP_IGNORE_INVALID",
				message: "worktreeSetupIgnorePaths must be an array of strings when set",
				suggestedCommand: "spine settings set worktreeSetupIgnorePaths '[]'",
			};
		}
		for (const entry of config.worktreeSetupIgnorePaths) {
			if (typeof entry !== "string" || !entry.trim()) {
				return {
					code: "CONFIG_SETUP_IGNORE_INVALID",
					message: "worktreeSetupIgnorePaths entries must be non-empty strings",
					suggestedCommand: "spine settings set worktreeSetupIgnorePaths '[]'",
				};
			}
		}
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

	const contractError = validateContractConfig(config);
	if (contractError) {
		return contractError;
	}

	return null;
}
