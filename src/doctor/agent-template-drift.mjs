/**
 * Agent prompt drift check: `.spine/agents/*.md` vs the packaged
 * `templates/agents/*.md` the CLI ships.
 *
 * Workers, reviewers and the supervisor read the project copy, not the template.
 * FR-WORK-08 lets a project append overrides after the base template, so a copy
 * is current when it starts with the template text; anything else means template
 * fixes (for example the final PASS/REVISE/REPLAN verdict shape) never reach the
 * agents. Advisory only: the operator decides how to merge local edits.
 */

import fs from "node:fs";
import path from "node:path";

import { AGENT_STUB_FILES, TEMPLATE_PATHS } from "../config/spine-init-constants.mjs";

/** @param {string} text */
function normalizeAgentText(text) {
	return text.replace(/\r\n/g, "\n").trimEnd();
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {Array<{ templateKey: string, destName: string }>} [params.agentFiles]
 * @param {Record<string, string>} [params.templatePaths] templateKey → absolute template path
 * @returns {{ label: string, ok: boolean, warning?: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildAgentTemplateDriftDoctorCheck({
	projectRoot,
	agentFiles = AGENT_STUB_FILES,
	templatePaths = TEMPLATE_PATHS.agents,
}) {
	/** @type {string[]} */
	const drifted = [];
	let compared = 0;

	for (const { templateKey, destName } of agentFiles) {
		const projectPath = path.join(projectRoot, ".spine", "agents", destName);
		const templatePath = templatePaths[templateKey];
		if (!templatePath || !fs.existsSync(projectPath) || !fs.existsSync(templatePath)) continue;
		compared += 1;
		const projectText = normalizeAgentText(fs.readFileSync(projectPath, "utf-8"));
		const templateText = normalizeAgentText(fs.readFileSync(templatePath, "utf-8"));
		if (!projectText.startsWith(templateText)) {
			drifted.push(`.spine/agents/${destName}`);
		}
	}

	if (drifted.length === 0) {
		return {
			label: "agent prompts match templates",
			ok: true,
			detail: compared === 0 ? "no agent files to compare" : `${compared} agent file(s) start with the packaged template`,
		};
	}

	return {
		label: "agent prompts match templates",
		ok: true,
		warning: true,
		detail: `${drifted.join(", ")} no longer start with the packaged template; template fixes do not reach these agents`,
		suggestedCommand: `diff templates/agents/<file> .spine/agents/<file> — rebase local edits after the template (or spine init --force to reset)`,
	};
}
