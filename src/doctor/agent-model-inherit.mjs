/**
 * Doctor warning when spine agents inherit pi's global model and pi defaults to LM Studio (SP-238).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LMSTUDIO_PROVIDER = "lmstudio";

/**
 * @param {string} settingsPath
 * @returns {Record<string, unknown>|null}
 */
export function readPiSettingsFile(settingsPath) {
	try {
		if (!fs.existsSync(settingsPath)) {
			return null;
		}
		return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Resolve pi defaultProvider (project `.pi/settings.json` overrides global).
 *
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {string} [options.globalSettingsPath]
 * @param {string} [options.projectSettingsPath]
 * @returns {string|null}
 */
export function resolvePiDefaultProvider(
	projectRoot,
	{ globalSettingsPath, projectSettingsPath } = {},
) {
	const globalPath =
		globalSettingsPath ?? path.join(os.homedir(), ".pi", "agent", "settings.json");
	const projectPath = projectSettingsPath ?? path.join(projectRoot, ".pi", "settings.json");
	const global = readPiSettingsFile(globalPath);
	const project = readPiSettingsFile(projectPath);
	const provider = project?.defaultProvider ?? global?.defaultProvider;
	if (typeof provider !== "string" || !provider.trim()) {
		return null;
	}
	return provider.trim().toLowerCase();
}

/**
 * @param {object} [config]
 * @returns {boolean}
 */
export function spineAgentsUseInherit(config = {}) {
	const workerModel = config.agents?.worker?.model;
	const reviewerModel = config.agents?.reviewer?.model;
	const inherits = (model) => !model || model === "inherit";
	return inherits(workerModel) || inherits(reviewerModel);
}

/**
 * @param {object} params
 * @param {object} [params.config]
 * @param {string} [params.projectRoot]
 * @param {() => string|null} [params.resolveProvider]
 */
export function buildAgentModelInheritDoctorCheck({
	config = {},
	projectRoot = process.cwd(),
	resolveProvider,
} = {}) {
	if (!spineAgentsUseInherit(config)) {
		return {
			label: "agents model inherit (pi-lmstudio)",
			ok: true,
			detail: "worker/reviewer pinned or inherit not used",
		};
	}

	const provider = resolveProvider
		? resolveProvider()
		: resolvePiDefaultProvider(projectRoot);
	if (provider !== LMSTUDIO_PROVIDER) {
		return {
			label: "agents model inherit (pi-lmstudio)",
			ok: true,
			detail: provider ? `pi default provider ${provider}` : "pi default provider unset",
		};
	}

	return {
		label: "agents model inherit (pi-lmstudio)",
		ok: true,
		warning: true,
		detail:
			"inherit + pi defaultProvider lmstudio — batch workers/reviewers may use local LM Studio; pin cursor/auto in spine-config",
		suggestedCommand:
			"spine settings set agents.worker.model cursor/auto && spine settings set agents.reviewer.model cursor/auto",
	};
}
