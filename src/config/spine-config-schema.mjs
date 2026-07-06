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
