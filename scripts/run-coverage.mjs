#!/usr/bin/env node
/**
 * Run the test suite with V8 line coverage on in-scope source and enforce COVERAGE_THRESHOLD.
 * Usage: node scripts/run-coverage.mjs [--report-only]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	COVERAGE_THRESHOLD,
	COVERAGE_INCLUDES,
	FILE_COVERAGE_THRESHOLDS,
	TEST_GLOBS,
} from "./coverage-policy.mjs";
import {
	parseAggregateLineCoverage,
	findFileCoverageFailures,
} from "./coverage-parse.mjs";

const reportOnly = process.argv.includes("--report-only");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const nodeArgs = [
	"--experimental-strip-types",
	"--experimental-test-coverage",
	...COVERAGE_INCLUDES.flatMap((pattern) => ["--test-coverage-include", pattern]),
	"--test",
	...TEST_GLOBS,
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
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

if (result.error) {
	console.error(`coverage run failed: ${result.error.message}`);
	process.exit(1);
}


const failMatch = combined.match(/\u2139 fail (\d+)/);
const failCount = failMatch ? Number.parseInt(failMatch[1], 10) : 0;
if (failCount > 0) {
	console.error(`Coverage run aborted: ${failCount} test failure(s).`);
	process.exit(result.status === 0 ? 1 : (result.status ?? 1));
}

const linePct = parseAggregateLineCoverage(combined);
if (linePct === null) {
	console.error(
		"Could not parse aggregate line coverage from test output (expected an 'all files' row).",
	);
	process.exit(2);
}

console.error(
	`Line coverage (in-scope): ${linePct.toFixed(2)}% (threshold: ${COVERAGE_THRESHOLD}%)`,
);

const fileFailures = findFileCoverageFailures(combined, FILE_COVERAGE_THRESHOLDS);
for (const failure of fileFailures) {
	const actualText =
		failure.actual === null ? "missing" : `${failure.actual.toFixed(2)}%`;
	console.error(
		`Per-file coverage failed: ${failure.path} ${actualText} < ${failure.required}% minimum.`,
	);
}

if (reportOnly) {
	process.exit(result.status ?? 1);
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

process.exit(result.status ?? 0);
