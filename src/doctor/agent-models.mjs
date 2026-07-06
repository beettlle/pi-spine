// @ts-nocheck
/**
 * Doctor check: validate that all agent model pins use canonical provider/model format (SP-422 / #76).
 */

import { validateModelIdFormat } from "../config/model-id.mjs";

/** @type {ReadonlyArray<{ path: string, get: (c: object) => unknown }>} */
const MODEL_PATHS = Object.freeze([
	{ path: "agents.worker.model", get: (c) => c?.agents?.worker?.model },
	{ path: "agents.reviewer.model", get: (c) => c?.agents?.reviewer?.model },
	{ path: "agents.reviewer.plan.model", get: (c) => c?.agents?.reviewer?.plan?.model },
	{ path: "agents.reviewer.code.model", get: (c) => c?.agents?.reviewer?.code?.model },
	{ path: "agents.reviewer.final.model", get: (c) => c?.agents?.reviewer?.final?.model },
	{ path: "agents.supervisor.model", get: (c) => c?.agents?.supervisor?.model },
]);

/**
 * @param {object} params
 * @param {object} [params.config]
 * @returns {{ label: string, ok: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildAgentModelIdsDoctorCheck({ config = {} } = {}) {
	/** @type {Array<{ path: string, error: string, suggestedCommand?: string }>} */
	const failures = [];

	for (const { path, get } of MODEL_PATHS) {
		const value = get(config);
		if (value == null || value === "" || value === "inherit") continue;
		if (typeof value !== "string") continue;

		const result = validateModelIdFormat(value);
		if (!result.ok) {
			const suggested = result.canonical
				? `spine settings set ${path} ${result.canonical}`
				: undefined;
			failures.push({ path, error: result.error, suggestedCommand: suggested });
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
