/**
 * Stub worker completion diagnosis helpers (SP-349 / GitHub #33, #40).
 */

import { isLegacyStubDoneMarker } from "./contract-verify.mjs";
import { parsePrompt } from "../tasks/packet/parse-prompt.mjs";

export const STUB_EXIT_REASONS = new Set(["stub"]);

/**
 * Surface `exitReason: stub` when legacy `.DONE` contains `Task: stub` on M/L implementation tasks.
 *
 * @param {string} promptMarkdown
 * @param {string} doneContent
 * @returns {string|null}
 */
export function inferStubExitReasonFromDoneMarker(promptMarkdown, doneContent) {
	if (!isLegacyStubDoneMarker(doneContent)) {
		return null;
	}
	const parsed = parsePrompt(promptMarkdown);
	if (parsed.size !== "M" && parsed.size !== "L") {
		return null;
	}
	return "stub";
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 */
export function buildStubFailureHeadline(batchLabel, ctx = {}) {
	return ctx.failedTaskId
		? `${batchLabel} task ${ctx.failedTaskId} stub-completed without file-scope changes`
		: `${batchLabel} stub worker completed without file-scope changes`;
}

/**
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 */
export function buildStubFailureSuggestedCommand(ctx = {}) {
	return ctx.failedTaskId
		? `unset SPINE_WORKER_STUB && spine batch retry ${ctx.failedTaskId}`
		: "unset SPINE_WORKER_STUB && spine batch resume";
}
