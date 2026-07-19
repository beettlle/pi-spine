// @ts-nocheck
/**
 * Orchestrator poll interval schema and resolvers (SP-452, GitHub #98).
 */

/** Default attached milestone reporter poll interval. */
export const DEFAULT_ATTACHED_MILESTONE_POLL_MS = 2_000;

/** Default sequence batch terminal wait poll interval. */
export const DEFAULT_SEQUENCE_POLL_MS = 5_000;

/** Default dashboard SSE poll interval (wired in SP-453). */
export const DEFAULT_DASHBOARD_POLL_MS = 2_000;

/** Lower bound for orchestrator poll intervals. */
export const MIN_ORCHESTRATOR_POLL_MS = 100;

/** Upper bound for orchestrator poll intervals. */
export const MAX_ORCHESTRATOR_POLL_MS = 60_000;

/** @type {Readonly<{ attachedMilestonePollMs: number; sequencePollMs: number; dashboardPollMs: number }>} */
export const ORCHESTRATOR_DEFAULTS = Object.freeze({
	attachedMilestonePollMs: DEFAULT_ATTACHED_MILESTONE_POLL_MS,
	sequencePollMs: DEFAULT_SEQUENCE_POLL_MS,
	dashboardPollMs: DEFAULT_DASHBOARD_POLL_MS,
});

/**
 * @param {unknown} value
 * @param {string} fieldLabel
 * @returns {{ ok: true, value: number } | { ok: false, code: string, message: string, suggestedCommand: string }}
 */
function validatePositivePollMs(value, fieldLabel) {
	if (value == null) {
		return { ok: true, value: 0 };
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
		return {
			ok: false,
			code: "CONFIG_ORCHESTRATOR_INVALID",
			message: `${fieldLabel} must be a positive integer when set`,
			suggestedCommand: "spine init --force",
		};
	}
	if (parsed < MIN_ORCHESTRATOR_POLL_MS || parsed > MAX_ORCHESTRATOR_POLL_MS) {
		return {
			ok: false,
			code: "CONFIG_ORCHESTRATOR_INVALID",
			message: `${fieldLabel} must be between ${MIN_ORCHESTRATOR_POLL_MS} and ${MAX_ORCHESTRATOR_POLL_MS}`,
			suggestedCommand: "spine init --force",
		};
	}
	return { ok: true, value: parsed };
}

/**
 * @param {Record<string, any>} config
 * @returns {null | { code: string; message: string; suggestedCommand: string }}
 */
export function validateOrchestratorConfig(config) {
	const orchestrator = config.orchestrator;
	if (orchestrator == null) {
		return null;
	}
	if (typeof orchestrator !== "object" || Array.isArray(orchestrator)) {
		return {
			code: "CONFIG_ORCHESTRATOR_INVALID",
			message: "orchestrator must be an object when set",
			suggestedCommand: "spine init --force",
		};
	}

	for (const [key, label] of [
		["attachedMilestonePollMs", "orchestrator.attachedMilestonePollMs"],
		["sequencePollMs", "orchestrator.sequencePollMs"],
		["dashboardPollMs", "orchestrator.dashboardPollMs"],
	]) {
		const result = validatePositivePollMs(orchestrator[key], label);
		if (!result.ok) {
			return result;
		}
	}

	return null;
}

/**
 * @param {object} [params]
 * @param {object} [params.config]
 */
export function resolveAttachedMilestonePollMs({ config = {} } = {}) {
	const configured = Number(config.orchestrator?.attachedMilestonePollMs);
	if (Number.isFinite(configured) && configured > 0) {
		return Math.min(Math.max(configured, MIN_ORCHESTRATOR_POLL_MS), MAX_ORCHESTRATOR_POLL_MS);
	}
	return DEFAULT_ATTACHED_MILESTONE_POLL_MS;
}

/**
 * @param {object} [params]
 * @param {object} [params.config]
 */
export function resolveSequencePollMs({ config = {} } = {}) {
	const configured = Number(config.orchestrator?.sequencePollMs);
	if (Number.isFinite(configured) && configured > 0) {
		return Math.min(Math.max(configured, MIN_ORCHESTRATOR_POLL_MS), MAX_ORCHESTRATOR_POLL_MS);
	}
	return DEFAULT_SEQUENCE_POLL_MS;
}

/**
 * @param {object} [params]
 * @param {object} [params.config]
 */
export function resolveDashboardPollMs({ config = {} } = {}) {
	const configured = Number(config.orchestrator?.dashboardPollMs);
	if (Number.isFinite(configured) && configured > 0) {
		return Math.min(Math.max(configured, MIN_ORCHESTRATOR_POLL_MS), MAX_ORCHESTRATOR_POLL_MS);
	}
	return DEFAULT_DASHBOARD_POLL_MS;
}

// --- Named agent model profiles (SP-664 / GitHub #216) ---

/**
 * Model-field accessors shared by schema validation and doctor checks.
 * Each accessor reads a model id from an `agents`-shaped object
 * (the base `agents` section or any named `agents.profiles.<name>` entry).
 * @type {ReadonlyArray<{ rel: string, get: (agents: any) => unknown }>}
 */
export const AGENT_MODEL_ACCESSORS = Object.freeze([
	{ rel: "worker.model", get: (agents) => agents?.worker?.model },
	{ rel: "reviewer.model", get: (agents) => agents?.reviewer?.model },
	{ rel: "reviewer.plan.model", get: (agents) => agents?.reviewer?.plan?.model },
	{ rel: "reviewer.code.model", get: (agents) => agents?.reviewer?.code?.model },
	{ rel: "reviewer.final.model", get: (agents) => agents?.reviewer?.final?.model },
	{ rel: "supervisor.model", get: (agents) => agents?.supervisor?.model },
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type-check every model field reachable from an agents-shaped object so malformed
 * profile sections (e.g. numeric model ids) fail fast at validation time rather than
 * surfacing later as a downstream spawn error.
 *
 * @param {any} agents An agents-shaped object (base section or named profile).
 * @param {string} label Dotted prefix used in error messages.
 * @returns {null | { code: string; message: string; suggestedCommand: string }}
 */
function validateAgentSectionModelTypes(agents, label) {
	for (const { rel, get } of AGENT_MODEL_ACCESSORS) {
		const value = get(agents);
		if (value != null && typeof value !== "string") {
			return {
				code: "CONFIG_AGENT_PROFILE_INVALID",
				message: `${label}.${rel} must be a string when set`,
				suggestedCommand: "spine init --force",
			};
		}
	}
	return null;
}

/**
 * Validate `agents.profiles`, `agents.activeProfile`, and `agents.escalatePolicy`.
 *
 * Named profiles mirror the base `worker`/`reviewer`/`supervisor` shape; the active
 * profile is resolved over base at load time (see `applyActiveAgentProfile`).
 * Structural validation only — canonical model-id format is checked by `spine doctor`.
 *
 * @param {Record<string, any>} config
 * @returns {null | { code: string; message: string; suggestedCommand: string }}
 */
export function validateAgentProfilesConfig(config) {
	const agents = config?.agents;
	if (agents == null || !isPlainObject(agents)) {
		return null;
	}

	const profiles = agents.profiles;
	if (profiles != null) {
		if (!isPlainObject(profiles)) {
			return {
				code: "CONFIG_AGENT_PROFILE_INVALID",
				message: "agents.profiles must be an object keyed by profile name",
				suggestedCommand: "spine init --force",
			};
		}
		for (const [name, profile] of Object.entries(profiles)) {
			if (!isPlainObject(profile)) {
				return {
					code: "CONFIG_AGENT_PROFILE_INVALID",
					message: `agents.profiles.${name} must be an object mirroring worker/reviewer/supervisor`,
					suggestedCommand: "spine init --force",
				};
			}
			const shapeError = validateAgentSectionModelTypes(profile, `agents.profiles.${name}`);
			if (shapeError) return shapeError;
		}
	}

	const activeProfile = agents.activeProfile;
	if (activeProfile != null) {
		if (typeof activeProfile !== "string") {
			return {
				code: "CONFIG_AGENT_PROFILE_INVALID",
				message: "agents.activeProfile must be a string when set",
				suggestedCommand: "spine settings set agents.activeProfile default",
			};
		}
		const trimmed = activeProfile.trim();
		// An empty/whitespace value clears the active profile; otherwise it must name a real profile.
		if (
			trimmed !== "" &&
			(!isPlainObject(profiles) || !Object.prototype.hasOwnProperty.call(profiles, trimmed))
		) {
			return {
				code: "CONFIG_AGENT_PROFILE_INVALID",
				message: `agents.activeProfile "${trimmed}" does not match a defined agents.profiles entry`,
				suggestedCommand: "spine settings set agents.activeProfile default",
			};
		}
	}

	const escalatePolicy = agents.escalatePolicy;
	if (escalatePolicy != null) {
		if (!isPlainObject(escalatePolicy)) {
			return {
				code: "CONFIG_AGENT_PROFILE_INVALID",
				message: "agents.escalatePolicy must be an object when set",
				suggestedCommand: "spine init --force",
			};
		}
		if (escalatePolicy.enabled != null && typeof escalatePolicy.enabled !== "boolean") {
			return {
				code: "CONFIG_AGENT_PROFILE_INVALID",
				message: "agents.escalatePolicy.enabled must be a boolean when set",
				suggestedCommand: "spine settings set agents.escalatePolicy.enabled true",
			};
		}
		if (escalatePolicy.toProfile != null) {
			if (typeof escalatePolicy.toProfile !== "string") {
				return {
					code: "CONFIG_AGENT_PROFILE_INVALID",
					message: "agents.escalatePolicy.toProfile must be a string when set",
					suggestedCommand: "spine init --force",
				};
			}
			const target = escalatePolicy.toProfile.trim();
			if (
				target !== "" &&
				(!isPlainObject(profiles) || !Object.prototype.hasOwnProperty.call(profiles, target))
			) {
				return {
					code: "CONFIG_AGENT_PROFILE_INVALID",
					message: `agents.escalatePolicy.toProfile "${target}" does not match a defined agents.profiles entry`,
					suggestedCommand: "spine settings set agents.escalatePolicy.toProfile hard",
				};
			}
		}
	}

	return null;
}
