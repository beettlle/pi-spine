import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import {
	DEFAULT_TASKPLANE_SOURCE_PATH,
	loadTaskplaneConfig,
	mapMaxParallel,
	mapTaskplaneToSpine,
} from "../../src/migrate/taskplane-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE_PATH = path.join(REPO_ROOT, ".pi", "taskplane-config.json");

test("loadTaskplaneConfig reads repo fixture", () => {
	const config = loadTaskplaneConfig(FIXTURE_PATH);
	assert.equal(config.configVersion, 1);
	assert.equal(config.taskRunner.paths.tasks, "taskplane-tasks");
});

test("mapTaskplaneToSpine maps repo fixture to valid spine config", () => {
	const taskplaneConfig = loadTaskplaneConfig(FIXTURE_PATH);
	const spineConfig = mapTaskplaneToSpine(taskplaneConfig);

	assert.equal(spineConfig.configVersion, 1);
	assert.equal(spineConfig.paths.tasksRoot, "taskplane-tasks");
	assert.equal(spineConfig.project.name, "pi-spine");
	assert.match(spineConfig.project.description, /Orchestration spine/);
	assert.equal(spineConfig.testing.test, "npm run typecheck");
	assert.equal(spineConfig.testing.build, "npm run typecheck");
	assert.equal(spineConfig.lanes.maxParallel, 5);
	assert.equal(validateSpineConfig(spineConfig), null);
});

test("mapTaskplaneToSpine honors tasksRootOverride", () => {
	const taskplaneConfig = loadTaskplaneConfig(FIXTURE_PATH);
	const spineConfig = mapTaskplaneToSpine(taskplaneConfig, { tasksRootOverride: "custom-tasks" });
	assert.equal(spineConfig.paths.tasksRoot, "custom-tasks");
});

test("mapTaskplaneToSpine ignores unknown keys", () => {
	const taskplaneConfig = loadTaskplaneConfig(FIXTURE_PATH);
	taskplaneConfig.unknownFutureField = { nested: true };
	const spineConfig = mapTaskplaneToSpine(taskplaneConfig);
	assert.equal(spineConfig.configVersion, 1);
	assert.equal("unknownFutureField" in spineConfig, false);
});

test("mapMaxParallel clamps invalid and excessive values", () => {
	assert.equal(mapMaxParallel(5), 5);
	assert.equal(mapMaxParallel(99), 8);
	assert.equal(mapMaxParallel(0), 3);
	assert.equal(mapMaxParallel("bad"), 3);
});

test("loadTaskplaneConfig fails loud on missing file", () => {
	assert.throws(
		() => loadTaskplaneConfig(path.join(REPO_ROOT, "missing-taskplane-config.json")),
		/Taskplane config not found/,
	);
});

test("DEFAULT_TASKPLANE_SOURCE_PATH matches repo layout", () => {
	assert.equal(DEFAULT_TASKPLANE_SOURCE_PATH, ".pi/taskplane-config.json");
	assert.ok(fs.existsSync(path.join(REPO_ROOT, DEFAULT_TASKPLANE_SOURCE_PATH)));
});
