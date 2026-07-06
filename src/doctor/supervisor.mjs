/**
 * Doctor checks for opt-in supervisor monitor (SP-444 / FR-SHIP-11).
 */

import fs from "node:fs";
import path from "node:path";

import {
	isSupervisorSpawnEnabled,
	resolveSupervisorModel,
	resolveSupervisorPollIntervalMs,
} from "../batch/supervisor-spawn.mjs";
import { validateModelIdFormat } from "../config/model-id.mjs";

const SUPERVISOR_AGENT_REL = ".spine/agents/supervisor.md";

/**
 * @param {object} params
 * @param {object} [params.config]
 * @param {string} [params.projectRoot]
 * @returns {{ label: string, ok: boolean, warning?: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildSupervisorConfigDoctorCheck({
	config = {},
	projectRoot = process.cwd(),
} = {}) {
	if (!isSupervisorSpawnEnabled(config)) {
		return {
			label: "agents.supervisor (opt-in monitor)",
			ok: true,
			detail: "disabled — no supervisor spawn on batch start",
		};
	}

	const templatePath = path.join(projectRoot, SUPERVISOR_AGENT_REL);
	if (!fs.existsSync(templatePath)) {
		return {
			label: "agents.supervisor (opt-in monitor)",
			ok: false,
			detail: "enabled but .spine/agents/supervisor.md missing — spawn will fail",
			suggestedCommand: "spine init",
		};
	}

	const model = resolveSupervisorModel(config);
	if (model !== "inherit") {
		const formatResult = validateModelIdFormat(model);
		if (!formatResult.ok) {
			return {
				label: "agents.supervisor (opt-in monitor)",
				ok: false,
				detail: `enabled but agents.supervisor.model invalid: ${formatResult.error}`,
				suggestedCommand: formatResult.canonical
					? `spine settings set agents.supervisor.model ${formatResult.canonical}`
					: "spine settings set agents.supervisor.model cursor/auto",
			};
		}
	}

	const pollMs = resolveSupervisorPollIntervalMs(config);
	return {
		label: "agents.supervisor (opt-in monitor)",
		ok: true,
		detail: `enabled; model=${model}; pollIntervalMs=${pollMs}`,
	};
}
