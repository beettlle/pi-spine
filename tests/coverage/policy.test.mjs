import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	COVERAGE_THRESHOLD,
	COVERAGE_INCLUDES,
	TEST_GLOBS,
} from "../../scripts/coverage-policy.mjs";
import { parseAggregateLineCoverage } from "../../scripts/coverage-parse.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("COVERAGE_THRESHOLD is 77", () => {
	assert.equal(COVERAGE_THRESHOLD, 77);
});

test("COVERAGE_INCLUDES scopes src, bin, and extensions", () => {
	assert.deepEqual(COVERAGE_INCLUDES, [
		"src/**/*.mjs",
		"bin/**/*.mjs",
		"extensions/**/*.ts",
	]);
});

test("TEST_GLOBS matches package.json test script entrypoints", () => {
	const pkg = JSON.parse(
		readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
	);
	const testScript = pkg.scripts.test;
	for (const glob of TEST_GLOBS) {
		assert.ok(testScript.includes(glob), `package.json test script missing ${glob}`);
	}
});

test("parseAggregateLineCoverage reads all files line percent", () => {
	const sample = `
ℹ all files                           |  81.11 |    66.23 |   88.14 |
ℹ end of coverage report
`;
	assert.equal(parseAggregateLineCoverage(sample), 81.11);
});

test("parseAggregateLineCoverage returns null when summary missing", () => {
	assert.equal(parseAggregateLineCoverage("no coverage here"), null);
});
