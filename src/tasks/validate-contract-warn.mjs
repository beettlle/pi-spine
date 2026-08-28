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

/** Code tasks should chain project lint/analyze in Contract testCommand (post-mortem v2.15.0 F-C). */
export const TEST_COMMAND_LINT_MISSING_FIX_HINT =
	"Prefix Contract testCommand with project lint/analyze (pi-spine: npm run lint &&). Docs-only testCommand: true is exempt.";

const PATCH_TASK_SIZES = new Set(["S", "M"]);
const LINT_IN_TEST_COMMAND_RE = /\b(?:lint|eslint|analyze)\b/;

/**
 * @param {string | null | undefined} testCommand
 * @returns {boolean}
 */
function testCommandIncludesLintOrAnalyze(testCommand) {
	if (!testCommand || testCommand === "true") {
		return true;
	}
	return LINT_IN_TEST_COMMAND_RE.test(testCommand);
}

/** Matches `npm test --` followed by at least one path/token argument. */
export const NPM_TEST_DASH_DASH_RE = /\bnpm\s+test\s+--\s+\S+/;

/**
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @returns {boolean}
 */
function matchesNpmTestDashDashPattern(parsed) {
	const testCommand = parsed?.testCommand;
	if (!testCommand || testCommand === "true") {
		return false;
	}
	return NPM_TEST_DASH_DASH_RE.test(testCommand);
}

/**
 * @param {"S"|"M"|"L"} taskSize
 * @returns {string}
 */
function formatNpmTestDashDashIssue(taskSize) {
	return `Contract testCommand uses npm test -- <path> on Size ${taskSize} patch task; npm runs the full suite, not the path. ${TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT}`;
}

/**
 * Error when required-mode S/M contracts use npm test -- <path> false scoping (issue #187).
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskSize?: "S"|"M"|"L"|"XL"|null }} [options]
 * @returns {string[]}
 */
export function collectNpmTestDashDashErrors(parsed, options = {}) {
	const taskSize = options.taskSize ?? null;
	if (!PATCH_TASK_SIZES.has(taskSize)) {
		return [];
	}

	if (!matchesNpmTestDashDashPattern(parsed)) {
		return [];
	}

	return [formatNpmTestDashDashIssue(taskSize)];
}

/**
 * Warn when S/M optional-mode or L task contracts use npm test -- <path> false scoping (issues #187, #141).
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskSize?: "S"|"M"|"L"|"XL"|null, mode?: "required" | "optional" | "legacy" }} [options]
 * @returns {string[]}
 */
export function collectNpmTestDashDashWarnings(parsed, options = {}) {
	const taskSize = options.taskSize ?? null;
	const mode = options.mode ?? "optional";

	if (taskSize === "L") {
		if (!matchesNpmTestDashDashPattern(parsed)) {
			return [];
		}
		return [formatNpmTestDashDashIssue(taskSize)];
	}

	if (!PATCH_TASK_SIZES.has(taskSize)) {
		return [];
	}

	// Required S/M promotes to validation errors in validateContract.
	if (mode === "required") {
		return [];
	}

	if (!matchesNpmTestDashDashPattern(parsed)) {
		return [];
	}

	return [formatNpmTestDashDashIssue(taskSize)];
}

/**
 * Warn when code-task contracts omit project lint/analyze from testCommand (post-mortem v2.15.0 F-C).
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskSize?: "S"|"M"|"L"|"XL"|null }} [options]
 * @returns {string[]}
 */
export function collectLintMissingWarnings(parsed, options = {}) {
	const taskSize = options.taskSize ?? null;
	if (taskSize !== "S" && taskSize !== "M" && taskSize !== "L") {
		return [];
	}

	const testCommand = parsed?.testCommand;
	if (!testCommand || testCommand === "true") {
		return [];
	}

	if (testCommandIncludesLintOrAnalyze(testCommand)) {
		return [];
	}

	return [
		`Contract testCommand omits project lint/analyze on Size ${taskSize} code task. ${TEST_COMMAND_LINT_MISSING_FIX_HINT}`,
	];
}

/**
 * Warn when S/M task contracts chain full-suite gates in testCommand.
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskSize?: "S"|"M"|"L"|"XL"|null, mode?: "required" | "optional" | "legacy" }} [options]
 * @returns {string[]}
 */
export function collectTestCommandScopeWarnings(parsed, options = {}) {
	const taskSize = options.taskSize ?? null;
	const mode = options.mode ?? "optional";

	const testCommand = parsed?.testCommand;
	if (!testCommand || testCommand === "true") {
		return [];
	}

	/** @type {string[]} */
	const warnings = [];

	if (PATCH_TASK_SIZES.has(taskSize)) {
		if (/\bcoverage:check\b/.test(testCommand)) {
			warnings.push(
				`Contract testCommand chains full coverage gate (coverage:check) on Size ${taskSize} patch task. ${TEST_COMMAND_COVERAGE_FIX_HINT}`,
			);
		}

		const npmTestDashDashWarnings = collectNpmTestDashDashWarnings(parsed, { taskSize, mode });
		if (npmTestDashDashWarnings.length > 0) {
			warnings.push(...npmTestDashDashWarnings);
		} else if (/\bnpm test\b/.test(testCommand)) {
			warnings.push(
				`Contract testCommand uses npm test on Size ${taskSize} patch task. ${TEST_COMMAND_NPM_TEST_FIX_HINT}`,
			);
		}

		warnings.push(...collectLintMissingWarnings(parsed, { taskSize }));
		return warnings;
	}

	if (taskSize === "L") {
		warnings.push(...collectNpmTestDashDashWarnings(parsed, { taskSize, mode }));
		warnings.push(...collectLintMissingWarnings(parsed, { taskSize }));
	}

	return warnings;
}
