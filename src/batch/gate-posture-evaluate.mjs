// @ts-check
/**
 * Pure gate posture evaluation cascade (SP-628 / FR-REL250-06 / #123).
 * No filesystem I/O — callers supply streak and config fields.
 *
 * Cascade (highest precedence first):
 *   1. posture locked
 *   2. never-auto-approve (LOCKED_CATEGORIES or explicit flag)
 *   3. alwaysBreakOn tag match
 *   4. immediate auto (autoApproveAfterN === 0)
 *   5. autoApproveAfterN streak threshold
 */

import { LOCKED_CATEGORIES, POSTURES } from "./gate-posture-defaults.mjs";

/** @typedef {import("./gate-posture-defaults.mjs").GateCategory} GateCategory */
/** @typedef {import("./gate-posture-defaults.mjs").GatePosture} GatePosture */

/**
 * @typedef {"allow-auto" | "require-manual"} GatePostureDecision
 */

/**
 * Cascade tier that produced the decision (1–5), or null when no auto path matched.
 * @typedef {1 | 2 | 3 | 4 | 5 | null} GatePostureTier
 */

/**
 * @typedef {{
 *   category: GateCategory;
 *   posture: GatePosture;
 *   autoApproveAfterN: number | null;
 *   consecutiveApprovals?: number;
 *   tags?: readonly string[];
 *   alwaysBreakOn?: readonly string[];
 *   neverAutoApprove?: boolean;
 * }} GatePostureEvaluateInput
 */

/**
 * @typedef {{
 *   decision: GatePostureDecision;
 *   reason: string;
 *   tier: GatePostureTier;
 * }} GatePostureEvaluateResult
 */

/**
 * Evaluate whether a gate may auto-approve under the 5-tier posture cascade.
 * Fail-closed: unknown thresholds and insufficient streak require manual approval.
 *
 * @param {GatePostureEvaluateInput} input
 * @returns {GatePostureEvaluateResult}
 */
export function evaluateGatePosture(input) {
	const {
		category,
		posture,
		autoApproveAfterN,
		consecutiveApprovals = 0,
		tags = [],
		alwaysBreakOn = [],
		neverAutoApprove = false,
	} = input;

	// 1. Posture locked — always manual
	if (posture === POSTURES.LOCKED) {
		return {
			decision: "require-manual",
			reason: `Category '${category}' requires explicit human approval (posture: locked)`,
			tier: 1,
		};
	}

	// 2. Never-auto-approve — locked categories and explicit flags
	if (LOCKED_CATEGORIES.includes(category) || neverAutoApprove === true) {
		const why = neverAutoApprove === true
			? "neverAutoApprove flag"
			: `category '${category}' is never auto-approved`;
		return {
			decision: "require-manual",
			reason: `Blocked by never-auto-approve: ${why}`,
			tier: 2,
		};
	}

	// 3. alwaysBreakOn tag intersection
	for (const breakTag of alwaysBreakOn) {
		if (tags.includes(breakTag)) {
			return {
				decision: "require-manual",
				reason: `Blocked by alwaysBreakOn tag: ${breakTag}`,
				tier: 3,
			};
		}
	}

	// 4. Immediate auto when threshold is zero
	if (autoApproveAfterN === 0) {
		return {
			decision: "allow-auto",
			reason: "Immediate auto-approve (autoApproveAfterN: 0)",
			tier: 4,
		};
	}

	// 5. Streak threshold (null / non-positive fails closed to manual)
	if (
		typeof autoApproveAfterN === "number" &&
		autoApproveAfterN > 0 &&
		consecutiveApprovals >= autoApproveAfterN
	) {
		return {
			decision: "allow-auto",
			reason: `Auto-approved after ${consecutiveApprovals} consecutive approvals (threshold: ${autoApproveAfterN})`,
			tier: 5,
		};
	}

	if (typeof autoApproveAfterN === "number" && autoApproveAfterN > 0) {
		return {
			decision: "require-manual",
			reason: `Streak ${consecutiveApprovals} below autoApproveAfterN threshold ${autoApproveAfterN}`,
			tier: 5,
		};
	}

	return {
		decision: "require-manual",
		reason: "No matching auto-approval path",
		tier: null,
	};
}
