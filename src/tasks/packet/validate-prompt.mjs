/**
 * Shared fail-loud PROMPT validation helpers (planner, preflight, rules CLI, batch engine).
 */

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
