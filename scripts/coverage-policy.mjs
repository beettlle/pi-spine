/**
 * Single source of truth for pi-spine line coverage policy (SP-061).
 * Used by scripts/run-coverage.mjs and tests/coverage/*.test.mjs.
 */

/** Minimum line coverage (percent) for src/, bin/, and extensions/. */
export const COVERAGE_THRESHOLD = 77;

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
	"tests/planner/*.test.mjs",
	"tests/batch/*.test.mjs",
	"tests/adoption/*.test.mjs",
	"tests/dashboard/*.test.mjs",
	"tests/doctor/*.test.mjs",
	"tests/migrate/*.test.mjs",
	"tests/worker-tools/*.test.mjs",
	"tests/coverage/*.test.mjs",
];
