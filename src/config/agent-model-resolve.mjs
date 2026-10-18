// @ts-nocheck
/**
 * Agent model/thinking pin resolution for reviewer spawns (issue #53 / SP-369).
 */

import { isSameModelFamily } from "./model-family.mjs";

/** @type {readonly ("plan"|"code"|"final")[]} */
const REVIEW_TYPES = ["plan", "code", "final"];

/**
 * @param {unknown} reviewer A reviewer block (`agents.reviewer` or `profile.reviewer`).
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null}
 */
function pickModelPin(reviewer, reviewType) {
	if (!reviewer) return null;

	const typePin = reviewer[reviewType]?.model;
	if (typeof typePin === "string" && typePin.length > 0 && typePin !== "inherit") {
		return typePin;
	}

	const topPin = reviewer.model;
	if (typeof topPin === "string" && topPin.length > 0 && topPin !== "inherit") {
		return topPin;
	}

	return null;
}

/**
 * @param {unknown} reviewer A reviewer block (`agents.reviewer` or `profile.reviewer`).
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null}
 */
function pickThinkingPin(reviewer, reviewType) {
	if (!reviewer) return null;

	const typePin = reviewer[reviewType]?.thinking;
	if (typeof typePin === "string" && typePin.length > 0) {
		if (typePin === "off") return null;
		if (typePin !== "inherit") return typePin;
	}

	const topPin = reviewer.thinking;
	if (typeof topPin === "string" && topPin.length > 0 && topPin !== "inherit" && topPin !== "off") {
		return topPin;
	}

	return null;
}

/**
 * @param {object} config
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null} Pin value or null to omit `--model`
 */
export function resolveReviewerModelPin(config, reviewType) {
	return pickModelPin(config?.agents?.reviewer, reviewType);
}

/**
 * @param {object} config
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null} Pin value or null to omit `--thinking`
 */
export function resolveReviewerThinkingPin(config, reviewType) {
	return pickThinkingPin(config?.agents?.reviewer, reviewType);
}

/**
 * @param {unknown} value
 * @returns {string|null} Trimmed non-empty string, else null
 */
function nonEmptyName(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

/**
 * Resolve the effective reviewer (model + thinking) per review type (SP-832 / #355).
 *
 * Candidate order (first cross-family usable candidate wins, per review type):
 *  1. `promptReviewerProfile`
 *  2. `agents.profiles[workerProfile].reviewerProfile`
 *  3. `agents.reviewerProfile`
 *  4. the already-merged `agents.reviewer` block
 *
 * A named profile that does not exist is reported in `blocked` (`unknown_reviewer_profile`);
 * one without a `reviewer` block is skipped with a warning. A candidate whose model shares a
 * family with `workerModel` is skipped for that review type; when none is cross-family the
 * type is reported in `blocked` (`same_model_family`) and the last candidate's pins are kept.
 *
 * Pure: no I/O, never mutates `config`.
 *
 * @param {object} config Effective config (active profile already merged into `agents.reviewer`).
 * @param {object} [options]
 * @param {string|null} [options.promptReviewerProfile]
 * @param {string|null} [options.workerProfile]
 * @param {string|null} [options.workerModel]
 * @returns {{
 *   plan: { model: string|null, thinking: string|null, profile: string|null, source: string },
 *   code: { model: string|null, thinking: string|null, profile: string|null, source: string },
 *   final: { model: string|null, thinking: string|null, profile: string|null, source: string },
 *   warnings: string[],
 *   blocked: Array<{ reviewType: "plan"|"code"|"final", reason: string }>,
 * }}
 */
export function resolveEffectiveReviewer(
	config,
	{ promptReviewerProfile = null, workerProfile = null, workerModel = null } = {},
) {
	const agents = config?.agents ?? {};
	const profiles = agents.profiles && typeof agents.profiles === "object" ? agents.profiles : {};
	const workerProfileName = nonEmptyName(workerProfile);
	/** @type {string[]} */
	const warnings = [];
	/** @type {Array<{ reviewType: "plan"|"code"|"final", reason: string }>} */
	const blocked = [];

	/** @type {Array<{ profile: string|null, source: string, reviewer: unknown }>} */
	const candidates = [];
	/** @type {Set<string>} */
	const seenNames = new Set();
	/** @type {Array<[string|null, string]>} */
	const named = [
		[nonEmptyName(promptReviewerProfile), "prompt.reviewerProfile"],
		[
			workerProfileName ? nonEmptyName(profiles[workerProfileName]?.reviewerProfile) : null,
			`agents.profiles.${workerProfileName}.reviewerProfile`,
		],
		[nonEmptyName(agents.reviewerProfile), "agents.reviewerProfile"],
	];
	for (const [name, source] of named) {
		if (name === null || seenNames.has(name)) continue;
		seenNames.add(name);
		const profile = Object.hasOwn(profiles, name) ? profiles[name] : undefined;
		if (!profile || typeof profile !== "object") {
			for (const reviewType of REVIEW_TYPES) {
				blocked.push({ reviewType, reason: "unknown_reviewer_profile" });
			}
			warnings.push(`reviewer profile "${name}" (${source}) is not defined in agents.profiles`);
			continue;
		}
		if (!profile.reviewer || typeof profile.reviewer !== "object") {
			warnings.push(`reviewer profile "${name}" has no reviewer block; falling back`);
			continue;
		}
		candidates.push({ profile: name, source, reviewer: profile.reviewer });
	}
	candidates.push({ profile: null, source: "agents.reviewer", reviewer: agents.reviewer });

	/** @type {Record<string, { model: string|null, thinking: string|null, profile: string|null, source: string }>} */
	const resolved = {};
	for (const reviewType of REVIEW_TYPES) {
		let chosen = null;
		let sameFamily = false;
		for (const candidate of candidates) {
			const model = pickModelPin(candidate.reviewer, reviewType);
			chosen = {
				model,
				thinking: pickThinkingPin(candidate.reviewer, reviewType),
				profile: candidate.profile,
				source: candidate.source,
			};
			sameFamily = isSameModelFamily(model, workerModel);
			if (!sameFamily) break;
			warnings.push(
				`${reviewType} reviewer "${model}" (${candidate.source}) shares a model family with worker "${workerModel}"; skipping`,
			);
		}
		if (sameFamily) blocked.push({ reviewType, reason: "same_model_family" });
		resolved[reviewType] = chosen;
	}

	return {
		plan: resolved.plan,
		code: resolved.code,
		final: resolved.final,
		warnings: [...new Set(warnings)],
		blocked,
	};
}
