/**
 * Validate-time checks for PROMPT.md `## Contract` tables (handoff §4.4).
 */

import micromatch from "micromatch";

const GLOB_PROBE = "__probe__.mjs";

/**
 * @param {ReturnType<import("./parse-prompt.mjs").parseContract>} parsed
 * @param {{ mode?: "required" | "optional" | "legacy" }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateContract(parsed, options = {}) {
	const mode = options.mode ?? "optional";
	const errors = [...(parsed.errors ?? [])];
	const warnings = [];

	if (mode === "legacy") {
		return { ok: errors.length === 0, errors, warnings };
	}

	if (!parsed.hasSection) {
		if (mode === "required") {
			errors.push("Missing ## Contract section");
		}
		return { ok: errors.length === 0, errors, warnings };
	}

	if (!parsed.rawTableValid) {
		return { ok: errors.length === 0, errors, warnings };
	}

	for (const field of parsed.unknownFields ?? []) {
		warnings.push(`Unknown contract field: ${field}`);
	}

	if (isContractTableEmpty(parsed) && mode === "required") {
		errors.push("Contract table is empty");
	}

	for (const field of ["fileScopeMustChange", "fileScopeMustNotChange", "artifactsMustExist"]) {
		for (const pattern of parsed[field] ?? []) {
			if (!isValidContractGlob(pattern)) {
				errors.push(`Contract ${field}: invalid glob pattern "${pattern}"`);
			}
		}
	}

	return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {ReturnType<import("./parse-prompt.mjs").parseContract>} parsed
 */
function isContractTableEmpty(parsed) {
	return (
		parsed.testCommand === null &&
		parsed.fileScopeMustChange.length === 0 &&
		parsed.fileScopeMustNotChange.length === 0 &&
		parsed.minLineCoverage === null &&
		parsed.artifactsMustExist.length === 0 &&
		(parsed.unknownFields?.length ?? 0) === 0
	);
}

/**
 * @param {string} pattern
 * @returns {boolean}
 */
function isValidContractGlob(pattern) {
	const trimmed = String(pattern ?? "").trim();
	if (!trimmed || trimmed.includes("\n")) {
		return false;
	}

	try {
		micromatch.isMatch(GLOB_PROBE, trimmed);
		micromatch.isMatch(trimmed, GLOB_PROBE);
		return true;
	} catch {
		return false;
	}
}
