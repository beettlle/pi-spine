// @ts-nocheck
/**
 * Doctor check: validate that all agent model pins use canonical provider/model format (SP-422 / #76).
 * Extended in SP-664 / #216 to also validate every named `agents.profiles.<name>` entry.
 */

import { validateModelIdFormat } from "../config/model-id.mjs";
import { AGENT_MODEL_ACCESSORS } from "../config/spine-config-schema.mjs";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Collect canonical-format failures for every model pin reachable from an
 * agents-shaped object. Used for both the base `agents` section and each named
 * profile entry, which share the worker/reviewer/supervisor shape.
 *
 * @param {unknown} agentsRoot Agents-shaped object (base section or a profile).
 * @param {string} pathPrefix Dotted prefix for messages (e.g. `agents` or `agents.profiles.hard`).
 * @param {Array<{ path: string, error: string, suggestedCommand?: string }>} failures Accumulator.
 */
function collectModelFailures(agentsRoot, pathPrefix, failures) {
	for (const { rel, get } of AGENT_MODEL_ACCESSORS) {
		const value = get(agentsRoot);
		if (value == null || value === "" || value === "inherit") continue;
		if (typeof value !== "string") continue;

		const result = validateModelIdFormat(value);
		if (!result.ok) {
			const path = `${pathPrefix}.${rel}`;
			const suggested = result.canonical
				? `spine settings set ${path} ${result.canonical}`
				: undefined;
			failures.push({ path, error: result.error, suggestedCommand: suggested });
		}
	}
}

/**
 * @param {object} params
 * @param {object} [params.config]
 * @returns {{ label: string, ok: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildAgentModelIdsDoctorCheck({ config = {} } = {}) {
	/** @type {Array<{ path: string, error: string, suggestedCommand?: string }>} */
	const failures = [];

	// Base agent pins — already reflect the active profile after load-time resolution.
	collectModelFailures(config?.agents, "agents", failures);

	// Validate each named profile independently so a misconfigured-but-inactive profile
	// is still flagged before an operator can activate it (SP-664 / #216).
	const profiles = config?.agents?.profiles;
	if (isPlainObject(profiles)) {
		for (const [name, profile] of Object.entries(profiles)) {
			if (!isPlainObject(profile)) continue;
			collectModelFailures(profile, `agents.profiles.${name}`, failures);
		}
	}

	if (failures.length === 0) {
		return {
			label: "agent model ids (canonical)",
			ok: true,
			detail: "all pins use provider/model format",
		};
	}

	return {
		label: "agent model ids (canonical)",
		ok: false,
		detail: failures.map((f) => `${f.path}: ${f.error}`).join("; "),
		suggestedCommand: failures[0].suggestedCommand,
	};
}
