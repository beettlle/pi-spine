import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	getScenario,
	listScenarios,
	loadRegistry,
	REGISTRY_SCHEMA_VERSION,
	resolveRegistryPath,
	SCENARIO_KINDS,
	scenarioRegistryPackageRoot,
	validateRegistry,
} from "../../src/fixtures/scenario-registry.mjs";

const packageRoot = scenarioRegistryPackageRoot();

/** Shipped registry entry count (6 incidents + SAT-020 stub + adoption + 2 recipes). */
const SHIPPED_SCENARIO_COUNT = 10;

test("resolveRegistryPath points at tests/fixtures/scenarios/registry.json", () => {
	const registryPath = resolveRegistryPath(packageRoot);
	assert.equal(
		registryPath,
		path.join(packageRoot, "tests", "fixtures", "scenarios", "registry.json"),
	);
	assert.ok(fs.existsSync(registryPath));
});

test("loadRegistry reads shipped registry", () => {
	const registry = loadRegistry({ packageRoot });
	assert.equal(registry.schemaVersion, REGISTRY_SCHEMA_VERSION);
	assert.equal(registry.scenarios.length, SHIPPED_SCENARIO_COUNT);
});

test("listScenarios returns sorted scenario entries", () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-registry-"));
	const registryDir = path.join(tempRoot, "tests", "fixtures", "scenarios");
	fs.mkdirSync(registryDir, { recursive: true });
	fs.writeFileSync(
		path.join(registryDir, "registry.json"),
		JSON.stringify({
			schemaVersion: 1,
			scenarios: [
				{ id: "z-last", kind: "recipe", title: "Z" },
				{ id: "a-first", kind: "recipe", title: "A" },
			],
		}),
		"utf-8",
	);

	const scenarios = listScenarios({ packageRoot: tempRoot });
	assert.deepEqual(
		scenarios.map((entry) => entry.id),
		["a-first", "z-last"],
	);
});

test("getScenario returns entry or null", () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-registry-get-"));
	const registryDir = path.join(tempRoot, "tests", "fixtures", "scenarios");
	fs.mkdirSync(registryDir, { recursive: true });
	fs.writeFileSync(
		path.join(registryDir, "registry.json"),
		JSON.stringify({
			schemaVersion: 1,
			scenarios: [{ id: "orphan-running-resume", kind: "incident", title: "Orphan running resume" }],
		}),
		"utf-8",
	);

	const found = getScenario("orphan-running-resume", { packageRoot: tempRoot });
	assert.equal(found?.title, "Orphan running resume");
	assert.equal(getScenario("missing", { packageRoot: tempRoot }), null);
});

test("validateRegistry passes for shipped registry with expected entry count", () => {
	const registry = loadRegistry({ packageRoot });
	assert.equal(registry.scenarios.length, SHIPPED_SCENARIO_COUNT);
	const result = validateRegistry(registry, { packageRoot });
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.deepEqual(result.errors, []);
});

test("shipped registry catalogs all incident fixtures from incidents README", () => {
	const registry = loadRegistry({ packageRoot });
	const incidentIds = registry.scenarios
		.filter((entry) => entry.kind === "incident")
		.map((entry) => entry.id)
		.sort();
	assert.deepEqual(incidentIds, [
		"lane-worktree-devcontainer",
		"orphan-running-resume",
		"pidless-ghost-running",
		"resume-orphan-historical-failure",
		"resume-parallel-lane-orphan",
		"retry-clears-failed-classification",
	]);
});

test("validateRegistry rejects invalid schema and entries", () => {
	const invalid = validateRegistry({ schemaVersion: 2, scenarios: [] });
	assert.equal(invalid.ok, false);
	assert.ok(invalid.errors.some((error) => error.includes("schemaVersion")));

	const missingArray = validateRegistry({ schemaVersion: 1 });
	assert.equal(missingArray.ok, false);
	assert.ok(missingArray.errors.some((error) => error.includes("scenarios must be an array")));

	const duplicateIds = validateRegistry(
		{
			schemaVersion: 1,
			scenarios: [
				{ id: "dup", kind: "recipe", title: "One" },
				{ id: "dup", kind: "recipe", title: "Two" },
			],
		},
		{ checkFixturePaths: false },
	);
	assert.equal(duplicateIds.ok, false);
	assert.ok(duplicateIds.errors.some((error) => error.includes("duplicate scenario id")));

	const badKind = validateRegistry(
		{
			schemaVersion: 1,
			scenarios: [{ id: "x", kind: "unknown", title: "Bad" }],
		},
		{ checkFixturePaths: false },
	);
	assert.equal(badKind.ok, false);
	assert.ok(badKind.errors.some((error) => error.includes("scenario.kind")));

	const missingFixture = validateRegistry(
		{
			schemaVersion: 1,
			scenarios: [{ id: "inc", kind: "incident", title: "Needs path" }],
		},
		{ checkFixturePaths: false },
	);
	assert.equal(missingFixture.ok, false);
	assert.ok(missingFixture.errors.some((error) => error.includes("fixturePath is required")));
});

test("validateRegistry checks fixture paths when enabled", () => {
	const result = validateRegistry(
		{
			schemaVersion: 1,
			scenarios: [
				{
					id: "orphan-running-resume",
					kind: "incident",
					title: "Orphan running resume",
					fixturePath: "tests/fixtures/incidents/orphan-running-resume.json",
				},
			],
		},
		{ packageRoot, checkFixturePaths: true },
	);
	assert.equal(result.ok, true, result.errors.join("; "));

	const missingPath = validateRegistry(
		{
			schemaVersion: 1,
			scenarios: [
				{
					id: "missing-fixture",
					kind: "incident",
					title: "Missing",
					fixturePath: "tests/fixtures/incidents/does-not-exist.json",
				},
			],
		},
		{ packageRoot, checkFixturePaths: true },
	);
	assert.equal(missingPath.ok, false);
	assert.ok(missingPath.errors.some((error) => error.includes("fixturePath does not exist")));
});

test("SCENARIO_KINDS documents supported fixture categories", () => {
	assert.deepEqual(SCENARIO_KINDS, ["incident", "stub", "adoption", "recipe"]);
});
