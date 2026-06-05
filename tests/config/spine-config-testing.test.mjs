import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	SPINE_INIT_COVERAGE_COMMAND,
	SPINE_INIT_TESTING_COMMAND,
	loadSpineConfigTemplate,
	runInit,
} from "../../bin/spine-init.mjs";
import { buildTestingEvidenceDoctorChecks } from "../../bin/spine-doctor.mjs";

test("spine-config template defaults mirror package.json script patterns", () => {
	const template = loadSpineConfigTemplate();
	assert.equal(template.testing.build, SPINE_INIT_TESTING_COMMAND);
	assert.equal(template.testing.test, SPINE_INIT_TESTING_COMMAND);
	assert.equal(template.testing.testWithCoverage, SPINE_INIT_COVERAGE_COMMAND);
});

test("init applies testing defaults including coverage command", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-config-testing-"));
	try {
		const result = runInit(projectRoot, ["--dry-run"]);
		assert.equal(result.ok, true);
		assert.equal(result.config.testing.build, SPINE_INIT_TESTING_COMMAND);
		assert.equal(result.config.testing.test, SPINE_INIT_TESTING_COMMAND);
		assert.equal(result.config.testing.testWithCoverage, SPINE_INIT_COVERAGE_COMMAND);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("dogfood spine-config has non-empty testing fields", () => {
	const configPath = path.resolve(".spine/spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	for (const field of ["build", "test", "testWithCoverage"]) {
		assert.ok(config.testing[field]?.trim(), `testing.${field} must be non-empty`);
	}
});

test("buildTestingEvidenceDoctorChecks warns on empty build when collectBuildEvidence", () => {
	const checks = buildTestingEvidenceDoctorChecks({
		gates: { collectBuildEvidence: true, collectTestEvidence: true },
		testing: { build: "", test: "npm test", testWithCoverage: "" },
	});
	assert.equal(checks.length, 1);
	assert.equal(checks[0].label, "testing.build (evidence gate)");
	assert.equal(checks[0].warning, true);
});

test("buildTestingEvidenceDoctorChecks warns on empty test when collectTestEvidence", () => {
	const checks = buildTestingEvidenceDoctorChecks({
		gates: { collectBuildEvidence: false, collectTestEvidence: true },
		testing: { build: "npm run typecheck", test: "", testWithCoverage: "" },
	});
	assert.equal(checks.length, 1);
	assert.equal(checks[0].label, "testing.test (evidence gate)");
	assert.equal(checks[0].warning, true);
});

test("buildTestingEvidenceDoctorChecks passes when commands configured", () => {
	const checks = buildTestingEvidenceDoctorChecks({
		gates: { collectBuildEvidence: true, collectTestEvidence: true },
		testing: {
			build: "npm run typecheck",
			test: "npm test",
			testWithCoverage: "npm run coverage:check",
		},
	});
	assert.deepEqual(checks, []);
});

test("buildTestingEvidenceDoctorChecks treats collectTestEvidence default as enabled", () => {
	const checks = buildTestingEvidenceDoctorChecks({
		gates: { collectBuildEvidence: false },
		testing: { build: "", test: "", testWithCoverage: "" },
	});
	assert.equal(checks.length, 1);
	assert.equal(checks[0].label, "testing.test (evidence gate)");
});
