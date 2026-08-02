import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	COVERAGE_THRESHOLD,
	COVERAGE_INCLUDES,
	FILE_COVERAGE_THRESHOLDS,
	FILE_COVERAGE_VERIFY_TESTS,
	TEST_GLOBS,
} from "../../scripts/coverage-policy.mjs";
import {
	parseAggregateLineCoverage,
	parsePerFileLineCoverage,
	findFileCoverageFailures,
} from "../../scripts/coverage-parse.mjs";

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

test("FILE_COVERAGE_THRESHOLDS enforces slash-commands.ts floor", () => {
	assert.equal(FILE_COVERAGE_THRESHOLDS["extensions/spine/slash-commands.ts"], 70);
});

test("FILE_COVERAGE_VERIFY_TESTS covers every FILE_COVERAGE_THRESHOLDS path", () => {
	for (const filePath of Object.keys(FILE_COVERAGE_THRESHOLDS)) {
		const globs = FILE_COVERAGE_VERIFY_TESTS[filePath];
		assert.ok(Array.isArray(globs), `missing verify globs for ${filePath}`);
		assert.ok(globs.length > 0, `empty verify globs for ${filePath}`);
	}
});

test("TEST_GLOBS includes metrics suite", () => {
	assert.ok(
		TEST_GLOBS.includes("tests/metrics/*.test.mjs"),
		"tests/metrics/*.test.mjs must be in TEST_GLOBS so SP-687+ quota tests run in release:check",
	);
});

function extractTestGlobsFromScript(testScript) {
	const matches = testScript.match(/tests\/[^\s]+\.test\.mjs/g);
	return matches ?? [];
}

test("TEST_GLOBS has bidirectional parity with package.json test script", () => {
	const pkg = JSON.parse(
		readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
	);
	const npmTestGlobs = extractTestGlobsFromScript(pkg.scripts.test);
	assert.deepEqual(
		TEST_GLOBS,
		npmTestGlobs,
		"TEST_GLOBS must match package.json test entrypoints exactly",
	);
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

test("parseAggregateLineCoverage reads coverage:check summary line", () => {
	assert.equal(
		parseAggregateLineCoverage("Line coverage (in-scope): 83.64% (threshold: 77%)"),
		83.64,
	);
});

test("parsePerFileLineCoverage reads per-file rows", () => {
	const sample = `
ℹ   slash-commands.ts                 |  71.42 |    80.00 |   50.00 |
ℹ   spine-orchestrator.ts             | 100.00 |   100.00 |  100.00 |
ℹ all files                           |  81.11 |    66.23 |   88.14 |
`;
	const byFile = parsePerFileLineCoverage(sample);
	assert.equal(byFile.get("slash-commands.ts"), 71.42);
	assert.equal(byFile.get("spine-orchestrator.ts"), 100);
	assert.equal(byFile.has("all"), false);
});

test("findFileCoverageFailures reports missing and below-threshold files", () => {
	const sample = `
ℹ   slash-commands.ts                 |  65.00 |    80.00 |   50.00 |
`;
	const failures = findFileCoverageFailures(sample, {
		"extensions/spine/slash-commands.ts": 70,
		"extensions/spine/missing.ts": 50,
	});
	assert.equal(failures.length, 2);
	assert.deepEqual(failures[0], {
		path: "extensions/spine/slash-commands.ts",
		actual: 65,
		required: 70,
	});
	assert.deepEqual(failures[1], {
		path: "extensions/spine/missing.ts",
		actual: null,
		required: 50,
	});
});
