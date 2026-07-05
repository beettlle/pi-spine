/**
 * Doctor check: probe pi provider credentials when spine agents inherit pi model (SP-460 / #97).
 */

import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { commandExists } from "../util/command-exists.mjs";
import {
	readPiSettingsFile,
	resolvePiDefaultProvider,
	spineAgentsUseInherit,
} from "./agent-model-inherit.mjs";

export const CURSOR_PROVIDER = "cursor";
export const LMSTUDIO_PROVIDER = "lmstudio";

const LIST_MODELS_TIMEOUT_MS = 30_000;
const AUTH_PROBE_TIMEOUT_MS = 15_000;

const SUGGESTED_PIN =
	"spine settings set agents.worker.model cursor/auto && spine settings set agents.reviewer.model cursor/auto";

/** @type {readonly RegExp[]} */
const AUTH_ERROR_PATTERNS = Object.freeze([
	/authentication_error/i,
	/\b401\b/,
	/invalid api key/i,
	/no api key found/i,
	/api key.*invalid/i,
	/credentials.*expired/i,
	/unauthorized/i,
]);

/**
 * @param {unknown} text
 * @returns {boolean}
 */
export function isAuthErrorText(text) {
	const combined = String(text ?? "");
	return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(combined));
}

/**
 * @param {unknown} output
 * @returns {Array<{ provider: string, id: string }>}
 */
export function parsePiListModelsRows(output) {
	const lines = String(output ?? "").split(/\r?\n/).filter(Boolean);
	let providerCol = 0;
	let modelCol = 1;
	let headerSeen = false;
	/** @type {Array<{ provider: string, id: string }>} */
	const rows = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!headerSeen && /^provider\b/i.test(trimmed)) {
			headerSeen = true;
			const lowerHeader = trimmed.toLowerCase().split(/\s+/);
			const providerIdx = lowerHeader.indexOf("provider");
			const modelIdx = lowerHeader.indexOf("model");
			if (providerIdx >= 0) providerCol = providerIdx;
			if (modelIdx >= 0) modelCol = modelIdx;
			continue;
		}
		if (!headerSeen) {
			continue;
		}

		const parts = trimmed.split(/\s+/);
		const provider = String(parts[providerCol] ?? parts[0] ?? "").trim().toLowerCase();
		const id = String(parts[modelCol] ?? parts[1] ?? "").trim();
		if (!provider || !id) {
			continue;
		}
		if (!/^[a-z0-9][a-z0-9._-]*$/i.test(provider)) {
			continue;
		}
		if (!/^[a-z0-9][a-z0-9._@-]*$/i.test(id)) {
			continue;
		}
		rows.push({ provider, id });
	}

	return rows;
}

/**
 * @param {unknown} output
 * @param {unknown} providerName
 * @returns {Array<{ provider: string, id: string }>}
 */
export function listModelsForProvider(output, providerName) {
	const normalized = String(providerName ?? "").trim().toLowerCase();
	return parsePiListModelsRows(output).filter((row) => row.provider === normalized);
}

/**
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {string} [options.globalSettingsPath]
 * @param {string} [options.projectSettingsPath]
 * @returns {string|null}
 */
export function resolvePiDefaultModel(
	projectRoot,
	{ globalSettingsPath, projectSettingsPath } = {},
) {
	const globalPath =
		globalSettingsPath ?? path.join(os.homedir(), ".pi", "agent", "settings.json");
	const projectPath = projectSettingsPath ?? path.join(projectRoot, ".pi", "settings.json");
	const global = readPiSettingsFile(globalPath);
	const project = readPiSettingsFile(projectPath);
	const model = project?.defaultModel ?? global?.defaultModel;
	if (typeof model !== "string" || !model.trim()) {
		return null;
	}
	return model.trim();
}

/**
 * @param {string|null} defaultModel
 * @param {string} provider
 * @param {Array<{ provider: string, id: string }>} listedModels
 * @returns {string|null}
 */
export function resolveModelIdForProvider(defaultModel, provider, listedModels) {
	if (defaultModel) {
		const slashIdx = defaultModel.indexOf("/");
		if (slashIdx >= 0) {
			const modelProvider = defaultModel.slice(0, slashIdx).toLowerCase();
			const modelId = defaultModel.slice(slashIdx + 1);
			if (modelProvider === provider.toLowerCase() && modelId) {
				return modelId;
			}
		} else if (listedModels.some((entry) => entry.id === defaultModel)) {
			return defaultModel;
		}
	}
	return listedModels[0]?.id ?? null;
}

/**
 * @param {string[]} args
 * @param {object} [options]
 * @param {typeof spawnSync} [options.spawnFn]
 * @param {number} [options.timeoutMs]
 */
export function runPiCommand(args, { spawnFn = spawnSync, timeoutMs = LIST_MODELS_TIMEOUT_MS } = {}) {
	const result = spawnFn("pi", args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: timeoutMs,
	});
	return {
		stdout: `${result?.stdout ?? ""}`,
		stderr: `${result?.stderr ?? ""}`,
		status: result?.status ?? 1,
		error: result?.error ?? null,
	};
}

/**
 * Lightweight auth probe for the pi provider spine agents inherit at worker spawn.
 *
 * @param {string} provider
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {typeof spawnSync} [options.spawnFn]
 * @param {string} [options.globalSettingsPath]
 * @param {string} [options.projectSettingsPath]
 * @returns {{ ok: boolean, detail: string }}
 */
export function probeInheritProviderAuth(
	provider,
	{
		projectRoot = process.cwd(),
		spawnFn = spawnSync,
		globalSettingsPath,
		projectSettingsPath,
	} = {},
) {
	const normalizedProvider = String(provider ?? "").trim().toLowerCase();
	if (!normalizedProvider) {
		return { ok: false, detail: "pi default provider unset" };
	}
	if (normalizedProvider === CURSOR_PROVIDER) {
		return { ok: true, detail: "cursor provider uses Cursor IDE auth" };
	}
	if (normalizedProvider === LMSTUDIO_PROVIDER) {
		return { ok: true, detail: "lmstudio uses local server auth" };
	}

	if (!commandExists("pi")) {
		return { ok: false, detail: "pi not installed" };
	}

	const listResult = runPiCommand(["--list-models"], { spawnFn });
	const listOutput = `${listResult.stdout}\n${listResult.stderr}`;
	if (listResult.error) {
		return { ok: false, detail: listResult.error.message };
	}

	const models = listModelsForProvider(listOutput, normalizedProvider);
	if (models.length === 0) {
		return {
			ok: false,
			detail: `no authenticated models for provider ${normalizedProvider} — run pi login or configure API keys`,
		};
	}

	const defaultModel = resolvePiDefaultModel(projectRoot, {
		globalSettingsPath,
		projectSettingsPath,
	});
	const modelId = resolveModelIdForProvider(defaultModel, normalizedProvider, models);
	if (!modelId) {
		return {
			ok: false,
			detail: `could not resolve model id for provider ${normalizedProvider}`,
		};
	}

	const probeResult = runPiCommand(
		["--provider", normalizedProvider, "--model", modelId, "--no-session", "-p", "ok"],
		{ spawnFn, timeoutMs: AUTH_PROBE_TIMEOUT_MS },
	);
	const probeOutput = `${probeResult.stdout}\n${probeResult.stderr}`;
	if (isAuthErrorText(probeOutput)) {
		return {
			ok: false,
			detail: `provider ${normalizedProvider} credentials rejected (authentication_error)`,
		};
	}
	if (probeResult.error) {
		return { ok: false, detail: probeResult.error.message };
	}
	if (probeResult.status !== 0) {
		return {
			ok: true,
			detail: `provider ${normalizedProvider}/${modelId} probe inconclusive (exit ${probeResult.status})`,
		};
	}

	return {
		ok: true,
		detail: `${normalizedProvider}/${modelId} credentials OK`,
	};
}

/**
 * @param {object} params
 * @param {object} [params.config]
 * @param {string} [params.projectRoot]
 * @param {() => string|null} [params.resolveProvider]
 * @param {typeof probeInheritProviderAuth} [params.probeAuth]
 */
export function buildInheritProviderAuthDoctorCheck({
	config = {},
	projectRoot = process.cwd(),
	resolveProvider,
	probeAuth = probeInheritProviderAuth,
} = {}) {
	if (!spineAgentsUseInherit(config)) {
		return {
			label: "agents inherit provider auth",
			ok: true,
			detail: "agents pinned — inherit provider auth not applicable",
		};
	}

	const provider = resolveProvider
		? resolveProvider()
		: resolvePiDefaultProvider(projectRoot);
	if (!provider) {
		return {
			label: "agents inherit provider auth",
			ok: true,
			warning: true,
			detail: "inherit active but pi defaultProvider unset — workers may fail at spawn",
			suggestedCommand: SUGGESTED_PIN,
		};
	}

	if (provider === CURSOR_PROVIDER) {
		return {
			label: "agents inherit provider auth",
			ok: true,
			detail: "inherit resolves to cursor — Cursor IDE auth",
		};
	}

	if (provider === LMSTUDIO_PROVIDER) {
		return {
			label: "agents inherit provider auth",
			ok: true,
			detail: "inherit resolves to lmstudio — see agents model inherit (pi-lmstudio) check",
		};
	}

	const probe = probeAuth(provider, { projectRoot });
	if (!probe.ok) {
		return {
			label: "agents inherit provider auth",
			ok: false,
			detail: `inherit + pi defaultProvider ${provider} — ${probe.detail}`,
			suggestedCommand: `pi login (refresh ${provider} credentials) or ${SUGGESTED_PIN}`,
		};
	}

	return {
		label: "agents inherit provider auth",
		ok: true,
		detail: `inherit + pi defaultProvider ${provider} — ${probe.detail}`,
	};
}
