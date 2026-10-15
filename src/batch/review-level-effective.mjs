/**
 * Effective review level for a task packet (SP-827 / #336).
 *
 * `**Type:** execute` packets run no reviewers (operator runbook §2.5), so
 * their effective review level is 0 regardless of the declared level. `llm`
 * packets return their declared level unchanged.
 */

import { parsePrompt } from "../tasks/packet/parse-prompt.mjs";
import { parseReviewLevel } from "./review-shared.mjs";

/**
 * @param {string} markdown PROMPT.md contents
 * @returns {number}
 */
export function effectiveReviewLevel(markdown) {
	if (parsePrompt(markdown).type === "execute") return 0;
	return parseReviewLevel(markdown);
}
