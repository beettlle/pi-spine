/**
 * Shared fail-loud PROMPT validation helpers (planner, preflight, rules CLI, batch engine).
 */

import { CONTRACT_DEFAULTS } from "../../config/defaults.mjs";
import {
	parseContract,
	parsePrompt,
	validatePrompt as validatePromptStructure,
} from "./parse-prompt.mjs";
import { validateContract } from "./validate-contract.mjs";

/**
 * Validate PROMPT.md structure and ## Contract per contract.mode (handoff §3.1, §4.4).
 *
 * @param {string} markdown PROMPT.md contents
 * @param {{ mode?: string, legacyTaskIdPrefixes?: string[], contract?: { mode?: string, legacyTaskIdPrefixes?: string[] } }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[], prompt: ReturnType<typeof parsePrompt>, contract: ReturnType<typeof parseContract> }}
 */
export function validatePrompt(markdown, options = {}) {
	const structure = validatePromptStructure(markdown);
	const errors = [...structure.errors];
	const mode =
		options.mode ??
		options.contract?.mode ??
		"optional";
	const legacyTaskIdPrefixes =
		options.legacyTaskIdPrefixes ??
		options.contract?.legacyTaskIdPrefixes ??
		[...CONTRACT_DEFAULTS.legacyTaskIdPrefixes];

	const contract = parseContract(markdown);
	const contractValidation = validateContract(contract, {
		mode,
		taskId: structure.prompt.taskId,
		legacyTaskIdPrefixes,
	});

	errors.push(...contractValidation.errors);

	return {
		ok: errors.length === 0,
		errors,
		warnings: contractValidation.warnings,
		prompt: structure.prompt,
		contract,
	};
}

/**
 * @param {{ validation?: { ok?: boolean, errors?: string[] }, promptPath?: string }} packet
 * @param {string} taskId
 * @returns {{ taskId: string, promptPath?: string, errors: string[] } | null}
 */
export function collectPromptValidationFailure(packet, taskId) {
	if (packet.validation?.ok) return null;
	return {
		taskId,
		promptPath: packet.promptPath,
		errors: packet.validation?.errors ?? ["Unknown PROMPT validation failure"],
	};
}

/**
 * @param {Array<{ taskId: string, promptPath?: string, errors: string[] }>} failures
 */
export function formatPromptValidationFailures(failures) {
	if (failures.length === 0) return "PROMPT validation failed";
	if (failures.length === 1) {
		const [failure] = failures;
		const location = failure.promptPath ? ` (${failure.promptPath})` : "";
		return `Invalid PROMPT for ${failure.taskId}${location}:\n${formatErrorLines(failure.errors)}`;
	}

	const lines = [`PROMPT validation failed for ${failures.length} task(s):`];
	for (const failure of failures) {
		const location = failure.promptPath ? ` (${failure.promptPath})` : "";
		lines.push(`${failure.taskId}${location}:`);
		lines.push(formatErrorLines(failure.errors));
	}
	return lines.join("\n");
}

/**
 * @param {{ validation?: { ok?: boolean, errors?: string[] }, promptPath?: string }} packet
 * @param {string} taskId
 */
export function assertValidTaskPacket(packet, taskId) {
	const failure = collectPromptValidationFailure(packet, taskId);
	if (!failure) return;
	throw new Error(formatPromptValidationFailures([failure]));
}

/**
 * @param {string[]} errors
 */
function formatErrorLines(errors) {
	return errors.map((error) => `  - ${error}`).join("\n");
}
