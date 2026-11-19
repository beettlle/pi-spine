// @ts-nocheck
/**
 * Validate-time warnings for Contract testCommand scope on patch-sized tasks (issue #141).
 * Also hosts the shared artifact-pattern safety predicate + worktree matcher (#309)
 * so src/batch modules stay under the 500-LOC policy (tests/cli/phase23-exit-verify).
 */

import fs from "node:fs";
import path from "node:path";
import picomatch from "picomatch";

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
 * Warn when an execute packet declares a Review Level above 0 (SP-827 / #336):
 * execute tasks run no reviewers, so the declared level is misleading.
 *
 * @param {{ type: string, reviewLevel: number }} options
 * @returns {string[]}
 */
export function collectExecuteReviewLevelWarnings({ type, reviewLevel }) {
	if (type !== "execute" || reviewLevel <= 0) {
		return [];
	}
	return [
		`Type: execute task declares Review Level ${reviewLevel}; execute tasks run no reviewers — set Review Level 0.`,
	];
}

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

/**
 * True when an artifact/scope pattern would resolve outside the lane worktree (#309):
 * a `..` path segment (parent-directory traversal) or an absolute path
 * (`/etc/...`, `C:/...`, `C:\\...`). Operates on the raw pattern string so both the
 * validation collector and the runtime `findArtifactMatch` share one rule.
 *
 * @param {string | null | undefined} pattern
 * @returns {boolean}
 */
export function isUnsafeArtifactScopePattern(pattern) {
	const normalized = String(pattern ?? "").replace(/\\/g, "/");
	if (!normalized) {
		return false;
	}
	if (normalized.split("/").includes("..")) {
		return true;
	}
	return normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized);
}

/** Fix hint for artifactsMustExist patterns that escape the lane worktree (#309). */
export const ARTIFACT_TRAVERSAL_FIX_HINT =
	"Use worktree-relative paths or globs without '..'; parent-directory traversal outside the lane worktree is rejected (#309).";

/**
 * Warn when Contract artifactsMustExist patterns contain `..` traversal or are
 * absolute paths — both resolve outside the lane worktree (#309).
 *
 * @param {ReturnType<import("./packet/parse-prompt.mjs").parseContract>} parsed
 * @returns {string[]}
 */
export function collectArtifactTraversalWarnings(parsed) {
	const patterns = parsed?.artifactsMustExist ?? [];
	/** @type {string[]} */
	const warnings = [];
	for (const pattern of patterns) {
		if (isUnsafeArtifactScopePattern(pattern)) {
			warnings.push(
				`Contract artifactsMustExist pattern escapes the lane worktree: ${pattern}. ${ARTIFACT_TRAVERSAL_FIX_HINT}`,
			);
		}
	}
	return warnings;
}

/** Matches any glob-magic character in a single path segment. */
const GLOB_MAGIC_RE = /[*?[\]{}]/;

/**
 * Locate an artifact inside the lane worktree, literal path or glob (#309).
 *
 * Fail-closed: patterns containing `..` or resolving outside `worktreePath` are
 * rejected with `unsafe: true` — they must never probe the host filesystem.
 * Glob patterns walk from the longest literal prefix so double-star patterns
 * match files under the worktree instead of a literal double-star segment.
 *
 * @param {string} worktreePath
 * @param {string} artifactPattern
 * @returns {{ ok: boolean, matchedPath?: string, unsafe?: boolean }}
 */
export function findArtifactMatch(worktreePath, artifactPattern) {
	// `src/**` + `/*.md` walks from `src/`, not from a literal `src/**` directory (#309).
	const normalized = String(artifactPattern ?? "").replace(/\\/g, "/");
	if (!normalized) {
		return { ok: false };
	}

	if (isUnsafeArtifactScopePattern(normalized)) {
		return { ok: false, unsafe: true };
	}

	// Containment guard: resolve against the worktree and require the result to stay inside it.
	const worktreeRoot = path.resolve(worktreePath);
	const resolved = path.resolve(worktreeRoot, normalized);
	if (resolved !== worktreeRoot && !resolved.startsWith(worktreeRoot + path.sep)) {
		return { ok: false, unsafe: true };
	}

	if (!GLOB_MAGIC_RE.test(normalized)) {
		return fs.existsSync(resolved) ? { ok: true, matchedPath: normalized } : { ok: false };
	}

	// Longest literal prefix of glob segments is the search root, so a
	// `src` + double-star + `*.md` pattern walks from `src/` (#309).
	const segments = normalized.split("/");
	let literalCount = 0;
	while (literalCount < segments.length && !GLOB_MAGIC_RE.test(segments[literalCount])) {
		literalCount += 1;
	}
	const baseDir = literalCount > 0 ? segments.slice(0, literalCount).join("/") : ".";
	const searchRoot = path.join(worktreeRoot, baseDir);
	if (!fs.existsSync(searchRoot)) {
		return { ok: false };
	}

	/** @type {Array<{ abs: string, rel: string }>} */
	const stack = [{ abs: searchRoot, rel: baseDir === "." ? "" : baseDir }];
	while (stack.length > 0) {
		const { abs, rel } = /** @type {{ abs: string, rel: string }} */ (stack.pop());
		for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
			const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
			const entryAbs = path.join(abs, entry.name);
			if (entry.isDirectory()) {
				stack.push({ abs: entryAbs, rel: entryRel });
				continue;
			}
			if (picomatch(normalized, { dot: true })(entryRel)) {
				return { ok: true, matchedPath: entryRel };
			}
		}
	}

	return { ok: false };
}
