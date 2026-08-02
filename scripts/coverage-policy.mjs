/**
 * Single source of truth for pi-spine line coverage policy (SP-061).
 * Used by scripts/run-coverage.mjs and tests/coverage/*.test.mjs.
 */

/** Minimum line coverage (percent) for src/, bin/, and extensions/. */
export const COVERAGE_THRESHOLD = 77;

/**
 * Per-file line coverage floors (FR-SHIP-06).
 * Keys are repo-relative POSIX paths matched against coverage report rows.
 */
export const FILE_COVERAGE_THRESHOLDS = Object.freeze({
	"extensions/spine/slash-commands.ts": 70,
});

/**
 * Owning test globs for FILE_COVERAGE_THRESHOLDS isolation re-verify.
 * Full-suite V8 attribution can under-report these modules (#222); when that
 * happens, run-coverage.mjs re-checks coverage against these focused suites.
 */
export const FILE_COVERAGE_VERIFY_TESTS = Object.freeze({
	"extensions/spine/slash-commands.ts": Object.freeze([
		"tests/extensions/*.test.mjs",
		"tests/slash-commands.test.mjs",
		"tests/spine-settings-slash.test.mjs",
	]),
});

/** Globs passed to Node --test-coverage-include (in-scope production code). */
export const COVERAGE_INCLUDES = [
	"src/**/*.mjs",
	"bin/**/*.mjs",
	"extensions/**/*.ts",
];

/** Test entrypoints (must stay aligned with package.json "test" script). */
export const TEST_GLOBS = [
	"tests/*.test.mjs",
	"tests/cli/*.test.mjs",
	"tests/compat/*.test.mjs",
	"tests/tasks/*.test.mjs",
	"tests/config/*.test.mjs",
	"tests/config/cursor-rules/*.test.mjs",
	"tests/planner/*.test.mjs",
	"tests/batch/*.test.mjs",
	"tests/metrics/*.test.mjs",
	"tests/agents/*.test.mjs",
	"tests/adoption/*.test.mjs",
	"tests/dashboard/*.test.mjs",
	"tests/doctor/*.test.mjs",
	"tests/init/*.test.mjs",
	"tests/migrate/*.test.mjs",
	"tests/worker-tools/*.test.mjs",
	"tests/coverage/*.test.mjs",
	"tests/extensions/*.test.mjs",
];
