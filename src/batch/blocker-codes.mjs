/**
 * Allow-listed BlockerCode values and `{ code, message }` helper (FR-REL250-03 / #122).
 *
 * Pure module — gate/readiness wiring lands in SP-626. Unknown codes fail closed.
 */

/** @typedef {(typeof BLOCKER_CODES)[number]} BlockerCode */

/**
 * @typedef {object} Blocker
 * @property {BlockerCode} code
 * @property {string} message
 */

/**
 * Integrate/gate codes cover `checkIntegrateGate` fail paths and SP-624 revision drift.
 * Readiness codes mirror pi-conductor evidence-service names from #122 for automation parity.
 *
 * @type {readonly string[]}
 */
export const BLOCKER_CODES = Object.freeze([
	"missing_gate",
	"gate_pending",
	"gate_rejected",
	"stale_revision",
	"force_integrate_blocked",
	"missing_task",
	"task_not_terminal",
	"open_gate",
	"missing_completion_report",
	"missing_test_result",
	"missing_commit",
	"missing_push",
	"missing_ready_for_pr_gate",
]);

/** @type {ReadonlySet<string>} */
const BLOCKER_CODE_SET = new Set(BLOCKER_CODES);

/**
 * @param {unknown} code
 * @returns {code is BlockerCode}
 */
export function isBlockerCode(code) {
	return typeof code === "string" && BLOCKER_CODE_SET.has(code);
}

/**
 * Build a structured blocker. Rejects unknown codes and empty messages fail-closed.
 *
 * @param {string} code
 * @param {string} message
 * @returns {Blocker}
 */
export function makeBlocker(code, message) {
	if (!isBlockerCode(code)) {
		throw new Error(`Unknown BlockerCode: ${String(code)}`);
	}
	if (typeof message !== "string" || message.trim().length === 0) {
		throw new Error("Blocker message must be a non-empty string");
	}
	return { code, message };
}
