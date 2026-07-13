// @ts-nocheck
/**
 * Retry suggestion sanitization — journal salvage payloads may be stale.
 */

const INVALID_BARE_RETRY_FORCE = /^spine batch retry --force$/;

/**
 * Retry suggestions must include a task id; journal salvage payloads may be stale.
 *
 * @param {string|null|undefined} command
 * @param {string|null|undefined} taskId
 * @returns {string|null}
 */
export function sanitizeRetrySuggestedCommand(command, taskId) {
	if (typeof command !== "string" || command.length === 0) {
		return command ?? null;
	}
	if (INVALID_BARE_RETRY_FORCE.test(command.trim())) {
		return taskId ? `spine batch retry ${taskId}` : "spine status --diagnose";
	}
	return command;
}
