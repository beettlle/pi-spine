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
	TEST_GLOBS,
} from "./coverage-policy.mjs";
import { parseAggregateLineCoverage } from "./coverage-parse.mjs";

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

if (reportOnly) {
	process.exit(result.status ?? 1);
}

if (linePct < COVERAGE_THRESHOLD) {
	console.error(
		`Coverage check failed: ${linePct.toFixed(2)}% < ${COVERAGE_THRESHOLD}% minimum.`,
	);
	process.exit(1);
}

process.exit(result.status ?? 0);
