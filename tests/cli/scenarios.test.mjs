import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { journalPath } from "../../src/batch/journal.mjs";
import { loadSpineBatchState, spineBatchStatePath } from "../../src/batch/state.mjs";
import {
	assertMaterializeAllowed,
	loadScenarioFixture,
	materializeFixtureToProject,
	runScenariosList,
	runScenariosMaterialize,
	runScenariosShow,
} from "../../bin/spine-cli/scenarios.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPINE_BIN = path.join(REPO_ROOT, "bin", "spine.mjs");
const INCIDENT_FIXTURE = "tests/fixtures/incidents/orphan-running-resume.json";

/**
 * @param {string} [prefix]
 */
function createTempRegistry(prefix = "spine-scenarios-cli-") {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	const registryDir = path.join(tempRoot, "tests", "fixtures", "scenarios");
	fs.mkdirSync(registryDir, { recursive: true });
	const fixtureDest = path.join(tempRoot, INCIDENT_FIXTURE);
	fs.mkdirSync(path.dirname(fixtureDest), { recursive: true });
	fs.copyFileSync(path.join(REPO_ROOT, INCIDENT_FIXTURE), fixtureDest);
	fs.writeFileSync(
		path.join(registryDir, "registry.json"),
		JSON.stringify(
			{
				schemaVersion: 1,
				scenarios: [
					{
						id: "orphan-running-resume",
						kind: "incident",
						title: "Orphan running resume",
						description: "Resume parallel lane orphan incident",
						fixturePath: INCIDENT_FIXTURE,
						tags: ["orphan", "resume"],
					},
					{
						id: "adoption-smoke-recipe",
						kind: "recipe",
						title: "Adoption smoke recipe",
						description: "Operator checklist only",
					},
				],
			},
			null,
			2,
		),
		"utf-8",
	);
	return tempRoot;
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, ...argv], {
		cwd: options.cwd ?? REPO_ROOT,
		env: { ...process.env, ...options.env },
		encoding: "utf-8",
	});
}

test("runScenariosList prints empty registry message", () => {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scenarios-list-empty-"));
	const registryDir = path.join(tempRoot, "tests", "fixtures", "scenarios");
	fs.mkdirSync(registryDir, { recursive: true });
	fs.writeFileSync(
		path.join(registryDir, "registry.json"),
		JSON.stringify({ schemaVersion: 1, scenarios: [] }),
		"utf-8",
	);
	const result = runScenariosList({ packageRoot: tempRoot });
	assert.equal(result.exitCode, 0);
	assert.match(result.output, /No scenarios registered/);
});

test("runScenariosList returns sorted scenarios as JSON", () => {
	const tempRoot = createTempRegistry("spine-scenarios-list-json-");
	const result = runScenariosList({ packageRoot: tempRoot, json: true });
	assert.equal(result.exitCode, 0);
	const payload = JSON.parse(result.output);
	assert.deepEqual(
		payload.scenarios.map((entry) => entry.id),
		["adoption-smoke-recipe", "orphan-running-resume"],
	);
});

test("runScenariosShow returns scenario details", () => {
	const tempRoot = createTempRegistry("spine-scenarios-show-");
	const result = runScenariosShow({
		id: "orphan-running-resume",
		packageRoot: tempRoot,
		json: true,
	});
	assert.equal(result.exitCode, 0);
	const payload = JSON.parse(result.output);
	assert.equal(payload.scenario.kind, "incident");
	assert.equal(payload.scenario.fixturePath, INCIDENT_FIXTURE);
});

test("runScenariosShow rejects unknown scenario", () => {
	const tempRoot = createTempRegistry("spine-scenarios-show-missing-");
	const result = runScenariosShow({
		id: "missing",
		packageRoot: tempRoot,
	});
	assert.equal(result.exitCode, 1);
	assert.match(result.output, /Unknown scenario/);
});

test("loadScenarioFixture reads incident fixture from registry entry", () => {
	createTempRegistry("spine-scenarios-load-fixture-");
	const scenario = {
		id: "orphan-running-resume",
		kind: "incident",
		fixturePath: INCIDENT_FIXTURE,
	};
	const fixture = loadScenarioFixture(scenario, REPO_ROOT);
	assert.equal(fixture.batchState.batchId, "20260603T185308");
	assert.ok(Array.isArray(fixture.journalTail));
});

test("loadScenarioFixture rejects recipe kind", () => {
	assert.throws(
		() =>
			loadScenarioFixture(
				{ id: "adoption-smoke-recipe", kind: "recipe", fixturePath: INCIDENT_FIXTURE },
				REPO_ROOT,
			),
		/cannot be materialized/,
	);
});

test("materializeFixtureToProject writes batch-state and journal tail", async () => {
	const projectRoot = await initGitRepo("spine-scenarios-materialize-");
	try {
		const scenario = {
			id: "orphan-running-resume",
			kind: "incident",
			fixturePath: INCIDENT_FIXTURE,
		};
		const fixture = loadScenarioFixture(scenario, REPO_ROOT);
		const result = materializeFixtureToProject(projectRoot, fixture);

		assert.equal(result.batchId, "20260603T185308");
		assert.ok(fs.existsSync(spineBatchStatePath(projectRoot)));
		const loaded = loadSpineBatchState(projectRoot);
		assert.equal(loaded.raw?.batchId, "20260603T185308");
		assert.equal(loaded.raw?.phase, "running");

		const journalFile = journalPath(projectRoot, result.batchId);
		const lines = fs.readFileSync(journalFile, "utf-8").trim().split("\n");
		assert.equal(lines.length, fixture.journalTail.length);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assertMaterializeAllowed blocks when batch-state exists", async () => {
	const projectRoot = await initGitRepo("spine-scenarios-guard-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260101T000000", phase: "running" }),
			"utf-8",
		);

		const blocked = assertMaterializeAllowed(projectRoot, false);
		assert.equal(blocked.ok, false);
		assert.match(blocked.message, /active batch state present/);

		const allowed = assertMaterializeAllowed(projectRoot, true);
		assert.equal(allowed.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runScenariosMaterialize blocks active batch without --force", async () => {
	const tempRoot = createTempRegistry("spine-scenarios-materialize-block-");
	const projectRoot = await initGitRepo("spine-scenarios-materialize-block-proj-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260101T000000", phase: "running" }),
			"utf-8",
		);

		const result = runScenariosMaterialize({
			id: "orphan-running-resume",
			projectRoot,
			packageRoot: tempRoot,
			force: false,
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /active batch state present/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runScenariosMaterialize writes fixture with --force", async () => {
	const tempRoot = createTempRegistry("spine-scenarios-materialize-force-");
	const projectRoot = await initGitRepo("spine-scenarios-materialize-force-proj-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260101T000000", phase: "running" }),
			"utf-8",
		);

		const result = runScenariosMaterialize({
			id: "orphan-running-resume",
			projectRoot,
			packageRoot: tempRoot,
			force: true,
			json: true,
		});
		assert.equal(result.exitCode, 0, result.output);
		const payload = JSON.parse(result.output);
		assert.equal(payload.scenarioId, "orphan-running-resume");
		assert.equal(payload.batchId, "20260603T185308");
		assert.ok(fs.existsSync(path.join(projectRoot, payload.batchStatePath)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runScenariosMaterialize rejects recipe scenarios", () => {
	const tempRoot = createTempRegistry("spine-scenarios-materialize-recipe-");
	const result = runScenariosMaterialize({
		id: "adoption-smoke-recipe",
		projectRoot: tempRoot,
		packageRoot: tempRoot,
	});
	assert.equal(result.exitCode, 1);
	assert.match(result.output, /cannot be materialized/);
});

test("spine scenarios CLI routes list and materialize", async () => {
	const tempRoot = createTempRegistry("spine-scenarios-cli-route-");
	const projectRoot = await initGitRepo("spine-scenarios-cli-route-proj-");
	try {
		const list = runSpine(["scenarios", "list", "--json"], {
			cwd: REPO_ROOT,
			env: { SPINE_SCENARIO_REGISTRY_ROOT: tempRoot },
		});
		assert.equal(list.status, 0, list.stderr || list.stdout);

		const materialize = runSpine(
			["scenarios", "materialize", "orphan-running-resume", "--target", projectRoot, "--json"],
			{
				cwd: REPO_ROOT,
				env: { SPINE_SCENARIO_REGISTRY_ROOT: tempRoot },
			},
		);
		assert.equal(materialize.status, 0, materialize.stderr || materialize.stdout);
		const payload = JSON.parse(materialize.stdout);
		assert.equal(payload.batchId, "20260603T185308");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
