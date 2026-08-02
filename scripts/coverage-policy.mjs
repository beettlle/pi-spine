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

/**
 * Suite directories under tests/ intentionally excluded from TEST_GLOBS (and
 * therefore from the default `npm test` / `release:check` run).
 *
 * The discovery guard in tests/coverage/policy.test.mjs fails when a non-empty
 * `tests/<dir>/` (one containing `*.test.mjs`) is absent from TEST_GLOBS unless
 * the directory is listed here. This closes the v2.12.1 metrics-suite gap, where
 * a new suite directory was added but never wired into the globs and the
 * bidirectional-parity test could not detect it (#246 / post-mortem-v2.12.1 §F5).
 *
 * Usage: prefer adding a new suite to TEST_GLOBS **and** the package.json `test`
 * script so it runs by default. Only list a directory here when its `.test.mjs`
 * files are genuinely out-of-band (static/architectural checks, shared
 * fixtures, low-level util, or on-demand script-integration suites). The guard
 * also asserts every allow-listed directory still exists and still holds tests,
 * so stale entries fail loudly instead of accumulating.
 */
export const SUITE_DIR_ALLOWLIST = Object.freeze([
	// Static architecture checks (import-cycle detection, reconcile-fixture verify).
	"tests/arch",
	// Shared scenario fixtures + scenario-registry probe, not a standalone suite.
	"tests/fixtures",
	// Low-level atomic-write util unit test.
	"tests/fs",
	// Test-helper infrastructure (git/scenario fixtures); guards helper internals.
	"tests/helpers",
	// On-demand script-integration suites (release proof gate, best-of-n, stet).
	"tests/scripts",
	// Low-level command-exists util unit test.
	"tests/util",
]);
