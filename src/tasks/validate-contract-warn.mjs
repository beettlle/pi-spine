// @ts-nocheck
/**
 * Validate-time warnings for Contract testCommand scope on patch-sized tasks (issue #141).
 */

/** S/M patch tasks should not chain the integrate-owned full coverage gate in Contract. */
export const TEST_COMMAND_COVERAGE_FIX_HINT =
	"Remove coverage:check from Contract testCommand on S/M patch tasks; integrate gate runs full coverage at merge. Use scoped node --test for task tests.";

/** S/M patch tasks should prefer node --test over npm test (full suite in lane worktrees). */
export const TEST_COMMAND_NPM_TEST_FIX_HINT =
	"Use scoped node --test path/to.test.mjs instead of npm test on S/M patch tasks.";

/** npm test -- <path> does not scope; npm forwards args to the script, which still runs the full suite (issue #187). */
export const TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT =
	"npm test -- <path> runs the full suite, not the path argument. Use scoped node --test path/to.test.mjs instead.";

const PATCH_TASK_SIZES = new Set(["S", "M"]);

/** Matches `npm test --` followed by at least one path/token argument. */
const NPM_TEST_DASH_DASH_RE = /\bnpm\s+test\s+--\s+\S+/;

/**
 * Warn when S/M task contracts use npm test -- <path> false scoping (issues #187, #141).
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskSize?: "S"|"M"|"L"|"XL"|null }} [options]
 * @returns {string[]}
 */
export function collectNpmTestDashDashWarnings(parsed, options = {}) {
	const taskSize = options.taskSize ?? null;
	if (!PATCH_TASK_SIZES.has(taskSize)) {
		return [];
	}

	const testCommand = parsed?.testCommand;
	if (!testCommand || testCommand === "true") {
		return [];
	}

	if (!NPM_TEST_DASH_DASH_RE.test(testCommand)) {
		return [];
	}

	return [
		`Contract testCommand uses npm test -- <path> on Size ${taskSize} patch task; npm runs the full suite, not the path. ${TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT}`,
	];
}

/**
 * Warn when S/M task contracts chain full-suite gates in testCommand.
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskSize?: "S"|"M"|"L"|"XL"|null }} [options]
 * @returns {string[]}
 */
export function collectTestCommandScopeWarnings(parsed, options = {}) {
	const taskSize = options.taskSize ?? null;
	if (!PATCH_TASK_SIZES.has(taskSize)) {
		return [];
	}

	const testCommand = parsed?.testCommand;
	if (!testCommand || testCommand === "true") {
		return [];
	}

	/** @type {string[]} */
	const warnings = [];

	if (/\bcoverage:check\b/.test(testCommand)) {
		warnings.push(
			`Contract testCommand chains full coverage gate (coverage:check) on Size ${taskSize} patch task. ${TEST_COMMAND_COVERAGE_FIX_HINT}`,
		);
	}

	const npmTestDashDashWarnings = collectNpmTestDashDashWarnings(parsed, options);
	if (npmTestDashDashWarnings.length > 0) {
		warnings.push(...npmTestDashDashWarnings);
	} else if (/\bnpm test\b/.test(testCommand)) {
		warnings.push(
			`Contract testCommand uses npm test on Size ${taskSize} patch task. ${TEST_COMMAND_NPM_TEST_FIX_HINT}`,
		);
	}

	return warnings;
}
