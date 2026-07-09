/**
 * Meta-test for scripts/verify-reconcile-test-fixtures.mjs (#157).
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	formatReconcileFixtureViolations,
	listReconcileTestFiles,
	scanReconcileTestFile,
	scanReconcileTestFixtures,
} from "../../scripts/verify-reconcile-test-fixtures.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RECONCILE_TESTS_DIR = path.join(REPO_ROOT, "tests", "batch");

const BAD_FIXTURE_SOURCE = `import test from "node:test";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";

test("bad reconcile cwd fixture", () => {
	const result = reconcileBatch({ projectRoot: process.cwd() });
	assert.equal(result.diagnosis, null);
});
`;

test("guard passes on current reconcile test suite", () => {
	const violations = scanReconcileTestFixtures();
	assert.deepEqual(
		violations,
		[],
		formatReconcileFixtureViolations(violations) || "expected no violations",
	);
	assert.ok(listReconcileTestFiles().length >= 4, "expected reconcile*.test.mjs files");
});

test("guard flags projectRoot: process.cwd() in synthetic bad fixture", () => {
	const violations = scanReconcileTestFile(
		path.join(RECONCILE_TESTS_DIR, "reconcile-bad-fixture.test.mjs"),
		BAD_FIXTURE_SOURCE,
	);
	assert.ok(violations.length >= 2, formatReconcileFixtureViolations(violations));
	assert.ok(
		violations.some((violation) => violation.message.includes("projectRoot: process.cwd()")),
		"expected inline cwd projectRoot violation",
	);
	assert.ok(
		violations.some((violation) => violation.message.includes("git-fixture.mjs")),
		"expected missing git-fixture import violation",
	);
});

test("guard allows process.cwd() only for static fixture paths", () => {
	const goodSource = `import test from "node:test";
import path from "node:path";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

test("isolated reconcile fixture", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-guard-");
	try {
		reconcileBatch({ projectRoot });
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
`;
	const violations = scanReconcileTestFile(
		path.join(RECONCILE_TESTS_DIR, "reconcile-good-fixture.test.mjs"),
		goodSource,
	);
	assert.deepEqual(violations, []);
});
