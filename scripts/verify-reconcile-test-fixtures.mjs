#!/usr/bin/env node
/**
 * Static guard (#157): reconcile tests must not pass process.cwd() as projectRoot
 * to git-dependent helpers without initGitRepo()/destroyGitRepo() isolation.
 *
 * See tests/helpers/git-fixture.mjs and fix commit 7e1e5b3.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECONCILE_TEST_GLOB_DIR = path.join(REPO_ROOT, "tests", "batch");

/** Git-dependent reconcile entry points that require isolated fixtures. */
const GIT_DEPENDENT_CALLEES = [
	"reconcileBatch",
	"runReconciliationCheck",
];

/** Inline projectRoot: process.cwd() in an options object. */
const INLINE_CWD_PROJECT_ROOT_RE = /projectRoot\s*:\s*process\.cwd\(\)/;

/** Module- or test-scoped assignment of projectRoot from process.cwd(). */
const ASSIGN_CWD_PROJECT_ROOT_RE =
	/(?:const|let)\s+projectRoot\s*=\s*process\.cwd\(\)/;

/**
 * @param {string} source
 * @returns {boolean}
 */
function usesGitDependentReconcileHelpers(source) {
	return GIT_DEPENDENT_CALLEES.some((name) => source.includes(name));
}

/**
 * @param {string} source
 * @returns {boolean}
 */
function importsGitFixtureHelpers(source) {
	return (
		/initGitRepo/.test(source) &&
		/destroyGitRepo/.test(source) &&
		/git-fixture\.mjs/.test(source)
	);
}

/**
 * @param {string} filePath
 * @param {string} source
 * @returns {{ file: string, line: number, message: string }[]}
 */
export function scanReconcileTestFile(filePath, source) {
	/** @type {{ file: string, line: number, message: string }[]} */
	const violations = [];
	const relativeFile = path.relative(REPO_ROOT, filePath);

	if (!usesGitDependentReconcileHelpers(source)) {
		return violations;
	}

	const lines = source.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const lineNumber = index + 1;

		if (INLINE_CWD_PROJECT_ROOT_RE.test(line)) {
			violations.push({
				file: relativeFile,
				line: lineNumber,
				message:
					"projectRoot: process.cwd() passes the real checkout to git-dependent reconcile helpers; use initGitRepo() instead (#157)",
			});
		}

		if (ASSIGN_CWD_PROJECT_ROOT_RE.test(line)) {
			violations.push({
				file: relativeFile,
				line: lineNumber,
				message:
					"projectRoot = process.cwd() without initGitRepo() fixture; detached HEAD CI will fail (#157)",
			});
		}
	}

	if (!importsGitFixtureHelpers(source)) {
		violations.push({
			file: relativeFile,
			line: 1,
			message:
				"reconcile tests calling git-dependent helpers must import initGitRepo/destroyGitRepo from tests/helpers/git-fixture.mjs (#157)",
		});
	}

	return violations;
}

/**
 * @param {string} [testsDir]
 * @returns {string[]}
 */
export function listReconcileTestFiles(testsDir = RECONCILE_TEST_GLOB_DIR) {
	return fs
		.readdirSync(testsDir)
		.filter((name) => name.startsWith("reconcile") && name.endsWith(".test.mjs"))
		.map((name) => path.join(testsDir, name))
		.sort();
}

/**
 * @param {string} [testsDir]
 * @returns {{ file: string, line: number, message: string }[]}
 */
export function scanReconcileTestFixtures(testsDir = RECONCILE_TEST_GLOB_DIR) {
	/** @type {{ file: string, line: number, message: string }[]} */
	const violations = [];
	for (const filePath of listReconcileTestFiles(testsDir)) {
		const source = fs.readFileSync(filePath, "utf-8");
		violations.push(...scanReconcileTestFile(filePath, source));
	}
	return violations;
}

/**
 * @param {{ file: string, line: number, message: string }[]} violations
 * @returns {string}
 */
export function formatReconcileFixtureViolations(violations) {
	if (violations.length === 0) {
		return "";
	}
	return violations
		.map((violation) => `${violation.file}:${violation.line}: ${violation.message}`)
		.join("\n");
}

function main() {
	const violations = scanReconcileTestFixtures();
	if (violations.length > 0) {
		console.error("reconcile test fixture guard failed:\n");
		console.error(formatReconcileFixtureViolations(violations));
		process.exit(1);
	}
	console.log(
		`reconcile test fixture guard passed (${listReconcileTestFiles().length} files)`,
	);
}

const isMain =
	process.argv[1] !== undefined &&
	pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
	main();
}
