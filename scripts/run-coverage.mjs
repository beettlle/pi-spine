#!/usr/bin/env node
/**
 * Run the test suite with V8 line coverage on in-scope source and enforce COVERAGE_THRESHOLD.
 * Usage: node scripts/run-coverage.mjs [--report-only]
 *
 * On GitHub Actions, full TAP is written to coverage-run.tap.log instead of the
 * job log (Actions truncates huge dumps and hides diagnostics). Local runs still
 * stream TAP unless SPINE_COVERAGE_QUIET=1.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	COVERAGE_THRESHOLD,
	COVERAGE_INCLUDES,
	FILE_COVERAGE_THRESHOLDS,
	FILE_COVERAGE_VERIFY_TESTS,
	TEST_GLOBS,
} from "./coverage-policy.mjs";
import {
	parseAggregateLineCoverage,
	findFileCoverageFailures,
	parsePerFileLineCoverage,
} from "./coverage-parse.mjs";

const reportOnly = process.argv.includes("--report-only");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAP_LOG_PATH = path.join(repoRoot, "coverage-run.tap.log");
const onGitHubActions = process.env.GITHUB_ACTIONS === "true";
const quietTap =
	onGitHubActions ||
	process.env.SPINE_COVERAGE_QUIET === "1" ||
	process.env.SPINE_COVERAGE_QUIET === "true";

/**
 * @param {string[]} testGlobs
 * @param {{ coverageIncludes?: string[] }} [options]
 * @returns {{
 *   combined: string,
 *   status: number | null,
 *   signal: NodeJS.Signals | null,
 *   error: Error | undefined,
 *   stdout: string,
 *   stderr: string,
 * }}
 */
function runCoverageSuite(testGlobs, options = {}) {
	const coverageIncludes = options.coverageIncludes ?? COVERAGE_INCLUDES;
	const nodeArgs = [
		"--experimental-strip-types",
		"--experimental-test-coverage",
		...coverageIncludes.flatMap((pattern) => ["--test-coverage-include", pattern]),
		"--test",
		...testGlobs,
	];

	const env = {
		...process.env,
		SPINE_SUPPRESS_JOURNAL_ATTACH: process.env.SPINE_SUPPRESS_JOURNAL_ATTACH ?? "1",
		SPINE_WORKER_STUB: process.env.SPINE_WORKER_STUB ?? "1",
	};

	const result = spawnSync(process.execPath, nodeArgs, {
		cwd: repoRoot,
		env,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});

	const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	return {
		combined,
		status: result.status,
		signal: result.signal ?? null,
		error: result.error,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

/**
 * Parse Node test-runner summary counts (info-symbol or plain `fail N`).
 *
 * @param {string} combined
 * @returns {{ tests: number | null, pass: number | null, fail: number }}
 */
function parseTestSummaryCounts(combined) {
	const failMatch = combined.match(/(?:\u2139\s*)?fail\s+(\d+)/);
	const passMatch = combined.match(/(?:\u2139\s*)?pass\s+(\d+)/);
	const testsMatch = combined.match(/(?:\u2139\s*)?tests\s+(\d+)/);
	return {
		tests: testsMatch ? Number.parseInt(testsMatch[1], 10) : null,
		pass: passMatch ? Number.parseInt(passMatch[1], 10) : null,
		fail: failMatch ? Number.parseInt(failMatch[1], 10) : 0,
	};
}

/**
 * @param {string} combined
 * @param {number} limit
 * @returns {string[]}
 */
function extractNotOkLines(combined, limit = 40) {
	const lines = [];
	for (const match of combined.matchAll(/^not ok .+$/gm)) {
		lines.push(match[0]);
		if (lines.length >= limit) {
			break;
		}
	}
	return lines;
}

/**
 * Re-check a per-file floor against its owning suites when full-suite V8
 * attribution under-reports (#222). Fail closed if no verify globs or isolation
 * still below threshold.
 *
 * @param {{ path: string, actual: number | null, required: number }} failure
 * @returns {{ path: string, actual: number | null, required: number } | null}
 */
function reverifyFileCoverageFailure(failure) {
	const verifyGlobs = FILE_COVERAGE_VERIFY_TESTS[failure.path];
	if (!verifyGlobs || verifyGlobs.length === 0) {
		return failure;
	}

	console.error(
		`Per-file coverage under-reported in full suite (${failure.path}: ${
			failure.actual === null ? "missing" : `${failure.actual.toFixed(2)}%`
		}); re-verifying with owning suites…`,
	);

	// Narrow include to the failing file only. Broad COVERAGE_INCLUDES still
	// under-report this module's line % even when owning suites pass (#222).
	const isolated = runCoverageSuite([...verifyGlobs], {
		coverageIncludes: [failure.path],
	});
	if (isolated.error) {
		console.error(
			`Isolation re-verify failed to spawn for ${failure.path}: ${isolated.error.message}`,
		);
		return failure;
	}

	const byFile = parsePerFileLineCoverage(isolated.combined);
	const basename = path.basename(failure.path);
	const isolatedPct =
		byFile.get(failure.path) ?? byFile.get(basename) ?? null;

	if (isolatedPct !== null && isolatedPct >= failure.required) {
		console.error(
			`Per-file coverage isolation re-verify passed: ${failure.path} ${isolatedPct.toFixed(
				2,
			)}% ≥ ${failure.required}% (full-suite was ${
				failure.actual === null ? "missing" : `${failure.actual.toFixed(2)}%`
			}; known V8 attribution quirk #222).`,
		);
		return null;
	}

	console.error(
		`Per-file coverage isolation re-verify still failed: ${failure.path} ${
			isolatedPct === null ? "missing" : `${isolatedPct.toFixed(2)}%`
		} < ${failure.required}% minimum.`,
	);
	return {
		path: failure.path,
		actual: isolatedPct,
		required: failure.required,
	};
}

const full = runCoverageSuite(TEST_GLOBS);

try {
	fs.writeFileSync(TAP_LOG_PATH, full.combined, { encoding: "utf8" });
	console.error(`Wrote full coverage TAP to ${path.relative(repoRoot, TAP_LOG_PATH)}`);
} catch (err) {
	console.error(
		`Could not write ${TAP_LOG_PATH}: ${err instanceof Error ? err.message : String(err)}`,
	);
}

if (!quietTap) {
	process.stdout.write(full.stdout);
	process.stderr.write(full.stderr);
} else {
	console.error(
		"Quiet coverage mode: full TAP omitted from console (see coverage-run.tap.log).",
	);
}

if (full.error) {
	console.error(`coverage run failed: ${full.error.message}`);
	process.exit(1);
}

const summary = parseTestSummaryCounts(full.combined);
const notOkLines = extractNotOkLines(full.combined);
console.error(
	`Coverage suite process: status=${full.status ?? "null"} signal=${full.signal ?? "null"} tests=${summary.tests ?? "?"} pass=${summary.pass ?? "?"} fail=${summary.fail}`,
);

if (summary.fail > 0 || notOkLines.length > 0) {
	console.error(`Coverage run aborted: ${summary.fail} test failure(s) (not ok: ${notOkLines.length}).`);
	for (const line of notOkLines) {
		console.error(line);
	}
	process.exit(full.status === 0 ? 1 : (full.status ?? 1));
}

const linePct = parseAggregateLineCoverage(full.combined);
if (linePct === null) {
	console.error(
		"Could not parse aggregate line coverage from test output (expected an 'all files' row).",
	);
	process.exit(2);
}

console.error(
	`Line coverage (in-scope): ${linePct.toFixed(2)}% (threshold: ${COVERAGE_THRESHOLD}%)`,
);

let fileFailures = findFileCoverageFailures(full.combined, FILE_COVERAGE_THRESHOLDS);
if (!reportOnly && fileFailures.length > 0) {
	fileFailures = fileFailures
		.map((failure) => reverifyFileCoverageFailure(failure))
		.filter((failure) => failure !== null);
}

for (const failure of fileFailures) {
	const actualText =
		failure.actual === null ? "missing" : `${failure.actual.toFixed(2)}%`;
	console.error(
		`Per-file coverage failed: ${failure.path} ${actualText} < ${failure.required}% minimum.`,
	);
}

if (reportOnly) {
	process.exit(full.status ?? 1);
}

if (fileFailures.length > 0) {
	process.exit(1);
}

if (linePct < COVERAGE_THRESHOLD) {
	console.error(
		`Coverage check failed: ${linePct.toFixed(2)}% < ${COVERAGE_THRESHOLD}% minimum.`,
	);
	process.exit(1);
}

if (full.status !== 0 && full.status !== null) {
	const tail = full.combined.trimEnd().split("\n").slice(-40).join("\n");
	console.error(
		`Coverage suite exited ${full.status} with 0 parsed test failures and thresholds met.`,
	);
	console.error("Last 40 lines of coverage TAP (see coverage-run.tap.log for full output):");
	console.error(tail);
	process.exit(full.status);
}

if (full.signal) {
	console.error(`Coverage suite terminated by signal ${full.signal}`);
	process.exit(1);
}

process.exit(0);
