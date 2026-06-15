/**
 * Rules profile loader for `.spine/rules-profile.json` (cursor rules discovery).
 */

import fs from "node:fs";
import path from "node:path";

/** Relative path from project root to the rules profile file. */
export const RULES_PROFILE_REL_PATH = ".spine/rules-profile.json";

/**
 * @typedef {object} RulesProfileWorker
 * @property {string[]} alwaysInclude Paths relative to `.cursor/rules/`
 * @property {string[]} neverInclude Paths relative to `.cursor/rules/`
 * @property {boolean} globMatch When true, glob-triggered rules may match PROMPT File Scope (SP-091)
 */

/**
 * @typedef {object} RulesProfileReviewer
 * @property {boolean} enabled When false, reviewer rule selection is skipped (SP-247+)
 * @property {string[]} alwaysInclude Paths relative to `.cursor/rules/`
 * @property {string[]} neverInclude Paths relative to `.cursor/rules/`
 * @property {boolean} globMatch When true, glob-triggered rules may match review context
 * @property {number} maxRules Upper bound on rules selected for reviewer context
 */

/**
 * @typedef {object} RulesProfileDiscovery
 * @property {string[]} excludePatterns Micromatch patterns against rule `relPath`
 * @property {string[]} excludeRelPaths Paths under `.cursor/rules/` excluded from discovery
 */

/**
 * @typedef {object} RulesProfile
 * @property {number} profileVersion
 * @property {RulesProfileWorker} worker
 * @property {RulesProfileReviewer} reviewer
 * @property {RulesProfileDiscovery} discovery
 */

/** Built-in profile when `.spine/rules-profile.json` is missing. */
export const DEFAULT_RULES_PROFILE = Object.freeze({
	profileVersion: 1,
	worker: Object.freeze({
		alwaysInclude: Object.freeze(["taskplane-worker-cursor.mdc"]),
		neverInclude: Object.freeze([]),
		globMatch: true,
	}),
	reviewer: Object.freeze({
		enabled: true,
		alwaysInclude: Object.freeze([]),
		neverInclude: Object.freeze([
			"taskplane-worker-cursor.mdc",
			"taskplane-task-authoring.mdc",
		]),
		globMatch: true,
		maxRules: 32,
	}),
	discovery: Object.freeze({
		excludePatterns: Object.freeze(["*-brutal-audit"]),
		excludeRelPaths: Object.freeze([
			"audit-workflow.mdc",
			"cursor-integration.mdc",
			"taskplane/prompt-template.md",
			"taskplane/status-template.md",
		]),
	}),
});

/**
 * @typedef {object} RulesProfileLoadSuccess
 * @property {true} ok
 * @property {RulesProfile} profile Merged profile (neverInclude applied to alwaysInclude)
 * @property {"default" | "file"} source
 * @property {string} [profilePath]
 */

/**
 * @typedef {object} RulesProfileLoadError
 * @property {false} ok
 * @property {{ code: string, message: string }} error
 */

/**
 * @param {string} projectRoot
 * @returns {RulesProfileLoadSuccess | RulesProfileLoadError}
 */
export function loadRulesProfile(projectRoot) {
	const profilePath = path.join(projectRoot, RULES_PROFILE_REL_PATH);

	if (!fs.existsSync(profilePath)) {
		return {
			ok: true,
			profile: cloneProfile(DEFAULT_RULES_PROFILE),
			source: "default",
		};
	}

	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(profilePath, "utf-8"));
	} catch (err) {
		return {
			ok: false,
			error: {
				code: "RULES_PROFILE_INVALID",
				message: `Cannot parse rules profile: ${err.message}`,
			},
		};
	}

	const validationError = validateRulesProfile(parsed);
	if (validationError) {
		return {
			ok: false,
			error: validationError,
		};
	}

	const merged = mergeRulesProfile(DEFAULT_RULES_PROFILE, /** @type {RulesProfile} */ (parsed));
	return {
		ok: true,
		profile: merged,
		source: "file",
		profilePath,
	};
}

/**
 * @param {unknown} profile
 * @returns {{ code: string, message: string } | null}
 */
export function validateRulesProfile(profile) {
	if (typeof profile !== "object" || profile === null || Array.isArray(profile)) {
		return {
			code: "RULES_PROFILE_INVALID",
			message: "rules-profile.json must be a JSON object",
		};
	}

	if (profile.profileVersion !== 1) {
		return {
			code: "RULES_PROFILE_INVALID",
			message: `profileVersion must be 1 (found ${profile.profileVersion ?? "missing"})`,
		};
	}

	if (profile.worker != null) {
		const workerError = validateWorkerSection(profile.worker);
		if (workerError) {
			return workerError;
		}
	}

	if (profile.reviewer != null) {
		const reviewerError = validateReviewerSection(profile.reviewer);
		if (reviewerError) {
			return reviewerError;
		}
	}

	if (profile.discovery != null) {
		const discoveryError = validateDiscoverySection(profile.discovery);
		if (discoveryError) {
			return discoveryError;
		}
	}

	return null;
}

/**
 * @param {unknown} worker
 * @returns {{ code: string, message: string } | null}
 */
function validateWorkerSection(worker) {
	return validateRuleSelectionSection(worker, "worker");
}

/**
 * @param {unknown} reviewer
 * @returns {{ code: string, message: string } | null}
 */
function validateReviewerSection(reviewer) {
	const selectionError = validateRuleSelectionSection(reviewer, "reviewer");
	if (selectionError) {
		return selectionError;
	}

	if (reviewer.enabled != null && typeof reviewer.enabled !== "boolean") {
		return {
			code: "RULES_PROFILE_INVALID",
			message: "reviewer.enabled must be a boolean",
		};
	}

	if (reviewer.maxRules != null) {
		if (
			typeof reviewer.maxRules !== "number" ||
			!Number.isInteger(reviewer.maxRules) ||
			reviewer.maxRules < 1
		) {
			return {
				code: "RULES_PROFILE_INVALID",
				message: "reviewer.maxRules must be a positive integer",
			};
		}
	}

	return null;
}

/**
 * @param {unknown} section
 * @param {string} label
 * @returns {{ code: string, message: string } | null}
 */
function validateRuleSelectionSection(section, label) {
	if (typeof section !== "object" || section === null || Array.isArray(section)) {
		return {
			code: "RULES_PROFILE_INVALID",
			message: `${label} must be an object`,
		};
	}

	const alwaysError = validateStringArray(section.alwaysInclude, `${label}.alwaysInclude`, {
		allowEmpty: true,
	});
	if (alwaysError) {
		return alwaysError;
	}

	const neverError = validateStringArray(section.neverInclude, `${label}.neverInclude`, {
		allowEmpty: true,
	});
	if (neverError) {
		return neverError;
	}

	if (section.globMatch != null && typeof section.globMatch !== "boolean") {
		return {
			code: "RULES_PROFILE_INVALID",
			message: `${label}.globMatch must be a boolean`,
		};
	}

	return null;
}

/**
 * @param {unknown} discovery
 * @returns {{ code: string, message: string } | null}
 */
function validateDiscoverySection(discovery) {
	if (typeof discovery !== "object" || discovery === null || Array.isArray(discovery)) {
		return {
			code: "RULES_PROFILE_INVALID",
			message: "discovery must be an object",
		};
	}

	const patternsError = validateStringArray(
		discovery.excludePatterns,
		"discovery.excludePatterns",
		{ allowEmpty: true },
	);
	if (patternsError) {
		return patternsError;
	}

	const relPathsError = validateStringArray(discovery.excludeRelPaths, "discovery.excludeRelPaths", {
		allowEmpty: true,
	});
	if (relPathsError) {
		return relPathsError;
	}

	return null;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @param {{ allowEmpty?: boolean }} [options]
 * @returns {{ code: string, message: string } | null}
 */
function validateStringArray(value, label, options = {}) {
	if (value == null) {
		return null;
	}
	if (!Array.isArray(value)) {
		return {
			code: "RULES_PROFILE_INVALID",
			message: `${label} must be an array of strings`,
		};
	}
	for (const entry of value) {
		if (typeof entry !== "string" || (!options.allowEmpty && entry.trim() === "")) {
			return {
				code: "RULES_PROFILE_INVALID",
				message: `${label} must contain non-empty strings`,
			};
		}
		if (entry.includes("..")) {
			return {
				code: "RULES_PROFILE_INVALID",
				message: `${label} must not contain path traversal`,
			};
		}
	}
	return null;
}

/**
 * Deep-merge file profile onto defaults; `neverInclude` wins over `alwaysInclude`.
 *
 * @param {RulesProfile} defaults
 * @param {RulesProfile} fileProfile
 * @returns {RulesProfile}
 */
export function mergeRulesProfile(defaults, fileProfile) {
	const alwaysInclude = normalizeRulePaths([
		...defaults.worker.alwaysInclude,
		...(fileProfile.worker?.alwaysInclude ?? []),
	]);
	const neverInclude = normalizeRulePaths([
		...defaults.worker.neverInclude,
		...(fileProfile.worker?.neverInclude ?? []),
	]);
	const neverSet = new Set(neverInclude);

	const reviewerAlwaysInclude = normalizeRulePaths([
		...defaults.reviewer.alwaysInclude,
		...(fileProfile.reviewer?.alwaysInclude ?? []),
	]);
	const reviewerNeverInclude = normalizeRulePaths([
		...defaults.reviewer.neverInclude,
		...(fileProfile.reviewer?.neverInclude ?? []),
	]);
	const reviewerNeverSet = new Set(reviewerNeverInclude);

	return {
		profileVersion: 1,
		worker: {
			alwaysInclude: alwaysInclude.filter((entry) => !neverSet.has(entry)),
			neverInclude,
			globMatch: fileProfile.worker?.globMatch ?? defaults.worker.globMatch,
		},
		reviewer: {
			enabled: fileProfile.reviewer?.enabled ?? defaults.reviewer.enabled,
			alwaysInclude: reviewerAlwaysInclude.filter((entry) => !reviewerNeverSet.has(entry)),
			neverInclude: reviewerNeverInclude,
			globMatch: fileProfile.reviewer?.globMatch ?? defaults.reviewer.globMatch,
			maxRules: fileProfile.reviewer?.maxRules ?? defaults.reviewer.maxRules,
		},
		discovery: {
			excludePatterns: normalizeRulePaths([
				...defaults.discovery.excludePatterns,
				...(fileProfile.discovery?.excludePatterns ?? []),
			]),
			excludeRelPaths: normalizeRulePaths([
				...defaults.discovery.excludeRelPaths,
				...(fileProfile.discovery?.excludeRelPaths ?? []),
			]),
		},
	};
}

/**
 * @param {string[]} paths
 * @returns {string[]}
 */
function normalizeRulePaths(paths) {
	/** @type {string[]} */
	const seen = [];
	for (const entry of paths) {
		const normalized = entry.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
		if (!normalized || seen.includes(normalized)) {
			continue;
		}
		seen.push(normalized);
	}
	return seen;
}

/**
 * @param {RulesProfile} profile
 * @returns {RulesProfile}
 */
function cloneProfile(profile) {
	return mergeRulesProfile(profile, {
		profileVersion: 1,
		worker: { alwaysInclude: [], neverInclude: [], globMatch: profile.worker.globMatch },
		reviewer: {
			alwaysInclude: [],
			neverInclude: [],
			globMatch: profile.reviewer.globMatch,
			enabled: profile.reviewer.enabled,
			maxRules: profile.reviewer.maxRules,
		},
		discovery: { excludePatterns: [], excludeRelPaths: [] },
	});
}
