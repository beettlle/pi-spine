import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	applySetting,
	runSettingsSetOperation,
	writeSpineConfigAtomic,
} from "../src/cli/settings-set.mjs";
import { getValueAtPath } from "../src/cli/settings-show.mjs";
import { destroyGitRepo, initGitRepo } from "./helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "spine.mjs");

function loadConfig(projectRoot) {
	return JSON.parse(fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8"));
}

test("applySetting merges nested dotted paths", () => {
	const config = { lanes: { maxParallel: 3, queueExcess: true } };
	const next = applySetting(config, "lanes.maxParallel", 2);
	assert.equal(getValueAtPath(next, "lanes.maxParallel"), 2);
	assert.equal(next.lanes.queueExcess, true);
	assert.equal(config.lanes.maxParallel, 3);
});

test("runSettingsSetOperation rejects unknown path", () => {
	const config = { lanes: { maxParallel: 3 } };
	const result = runSettingsSetOperation(config, { path: "lanes.unknown", rawValue: "2" });
	assert.equal(result.exitCode, 1);
	assert.match(result.output, /Unknown setting path/);
});

test("runSettingsSetOperation rejects invalid value", () => {
	const config = { lanes: { maxParallel: 3 } };
	const result = runSettingsSetOperation(config, { path: "lanes.maxParallel", rawValue: "0" });
	assert.equal(result.exitCode, 1);
	assert.match(result.output, />= 1/);
});

test("runSettingsSetOperation returns merged config on success", () => {
	const config = {
		configVersion: 1,
		project: { name: "demo", description: "" },
		paths: { tasksRoot: "taskplane-tasks" },
		baseBranch: "main",
		testing: { build: "", test: "", testWithCoverage: "" },
		agents: { worker: { model: "inherit", thinking: "high" } },
		lanes: { maxParallel: 3 },
		gates: { requireBeforeIntegrate: true },
	};
	const result = runSettingsSetOperation(config, { path: "lanes.maxParallel", rawValue: "2" });
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, 2);
	assert.equal(getValueAtPath(result.config, "lanes.maxParallel"), 2);
});

test("writeSpineConfigAtomic writes valid JSON atomically", async () => {
	const projectRoot = await initGitRepo("spine-settings-set-write-");
	try {
		const config = loadConfig(projectRoot);
		config.lanes.maxParallel = 4;
		writeSpineConfigAtomic(projectRoot, config);

		const onDisk = loadConfig(projectRoot);
		assert.equal(onDisk.lanes.maxParallel, 4);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings set updates maxParallel on disk", async () => {
	const projectRoot = await initGitRepo("spine-settings-set-cli-");
	try {
		const before = loadConfig(projectRoot).lanes.maxParallel;

		const set = spawnSync(process.execPath, [SPINE_BIN, "settings", "set", "lanes.maxParallel", "2"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.equal(set.status, 0, set.stderr);
		assert.match(set.stdout, /Updated lanes\.maxParallel/);

		const after = loadConfig(projectRoot);
		assert.equal(after.lanes.maxParallel, 2);
		assert.notEqual(before, 2);

		const show = spawnSync(process.execPath, [SPINE_BIN, "settings", "show", "lanes.maxParallel"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.equal(show.status, 0, show.stderr);
		assert.equal(show.stdout.trim(), "2");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings set rejects bad value", async () => {
	const projectRoot = await initGitRepo("spine-settings-set-bad-");
	try {
		const before = loadConfig(projectRoot);

		const result = spawnSync(
			process.execPath,
			[SPINE_BIN, "settings", "set", "lanes.maxParallel", "999"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(result.status, 1);
		assert.match(result.stdout, /<= 32/);

		const after = loadConfig(projectRoot);
		assert.deepEqual(after.lanes, before.lanes);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings set --dry-run leaves config unchanged", async () => {
	const projectRoot = await initGitRepo("spine-settings-set-dry-");
	try {
		const before = fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8");

		const result = spawnSync(
			process.execPath,
			[SPINE_BIN, "settings", "set", "lanes.maxParallel", "2", "--dry-run"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /dry run/i);

		const after = fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8");
		assert.equal(after, before);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings set --json reports write metadata", async () => {
	const projectRoot = await initGitRepo("spine-settings-set-json-");
	try {
		const result = spawnSync(
			process.execPath,
			[SPINE_BIN, "settings", "set", "gates.requireBeforeIntegrate", "false", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(result.status, 0, result.stderr);
		const parsed = JSON.parse(result.stdout);
		assert.equal(parsed.path, "gates.requireBeforeIntegrate");
		assert.equal(parsed.newValue, false);
		assert.equal(parsed.wrote, true);
		assert.equal(parsed.dryRun, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
