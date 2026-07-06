// @ts-nocheck
/**
 * Doctor warning when spine agents inherit pi's global model and pi defaults to LM Studio (SP-238).
 * Per-type reviewer effective pins (issue #53 / SP-371).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	resolveReviewerModelPin,
	resolveReviewerThinkingPin,
} from "../config/agent-model-resolve.mjs";

const LMSTUDIO_PROVIDER = "lmstudio";

/** @type {readonly ("plan"|"code"|"final")[]} */
const REVIEW_TYPES = ["plan", "code", "final"];

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
 * @param {unknown} model
 * @returns {boolean}
 */
function modelUsesInherit(model) {
	return !model || model === "inherit";
}

/**
 * @param {object} [config]
 * @returns {boolean}
 */
export function spineAgentsUseInherit(config = {}) {
	const workerModel = config.agents?.worker?.model;
	if (modelUsesInherit(workerModel)) {
		return true;
	}

	for (const reviewType of REVIEW_TYPES) {
		if (resolveReviewerModelPin(config, reviewType) === null) {
			return true;
		}
	}

	return false;
}

/**
 * @param {object} [config]
 * @returns {string}
 */
export function formatReviewerEffectivePins(config = {}) {
	return REVIEW_TYPES.map((reviewType) => {
		const modelPin = resolveReviewerModelPin(config, reviewType);
		const thinkingPin = resolveReviewerThinkingPin(config, reviewType);
		const modelLabel = modelPin ?? "inherit";
		const thinkingLabel = thinkingPin ?? "inherit";
		return `${reviewType}=${modelLabel}/${thinkingLabel}`;
	}).join(", ");
}

/**
 * @param {object} params
 * @param {object} [params.config]
 */
export function buildReviewerPerTypePinsDoctorCheck({ config = {} } = {}) {
	return {
		label: "reviewer model pins (per-type)",
		ok: true,
		detail: formatReviewerEffectivePins(config),
	};
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
	const perTypeDetail = formatReviewerEffectivePins(config);

	if (!spineAgentsUseInherit(config)) {
		return {
			label: "agents model inherit (pi-lmstudio)",
			ok: true,
			detail: `pinned — ${perTypeDetail}`,
		};
	}

	const provider = resolveProvider
		? resolveProvider()
		: resolvePiDefaultProvider(projectRoot);
	if (provider !== LMSTUDIO_PROVIDER) {
		return {
			label: "agents model inherit (pi-lmstudio)",
			ok: true,
			detail: provider
				? `pi default provider ${provider} — ${perTypeDetail}`
				: `pi default provider unset — ${perTypeDetail}`,
		};
	}

	return {
		label: "agents model inherit (pi-lmstudio)",
		ok: true,
		warning: true,
		detail:
			`inherit + pi defaultProvider lmstudio — batch workers/reviewers may use local LM Studio; pin cursor/auto in spine-config — ${perTypeDetail}`,
		suggestedCommand:
			"spine settings set agents.worker.model cursor/auto && spine settings set agents.reviewer.model cursor/auto",
	};
}
