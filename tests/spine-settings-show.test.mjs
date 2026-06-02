import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	buildSettingsShowFields,
	formatSettingsShow,
	getValueAtPath,
} from "../src/cli/settings-show.mjs";
import { destroyGitRepo, initGitRepo } from "./helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "spine.mjs");
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("getValueAtPath reads nested config values", () => {
	const config = {
		lanes: { maxParallel: 4 },
		agents: { worker: { thinking: "high" } },
	};
	assert.equal(getValueAtPath(config, "lanes.maxParallel"), 4);
	assert.equal(getValueAtPath(config, "agents.worker.thinking"), "high");
	assert.equal(getValueAtPath(config, "dashboard.port"), undefined);
});

test("formatSettingsShow lists all editable fields in human mode", () => {
	const config = {
		lanes: { maxParallel: 2 },
		gates: { requireBeforeIntegrate: false },
		agents: { worker: { model: "inherit", thinking: "low" } },
		dashboard: { port: 8200 },
	};

	const result = formatSettingsShow(config);
	assert.equal(result.exitCode, 0);
	assert.match(result.output, /lanes\.maxParallel/);
	assert.match(result.output, /Max parallel lanes: 2/);
	assert.match(result.output, /gates\.requireBeforeIntegrate/);
	assert.match(result.output, /agents\.worker\.model/);
	assert.match(result.output, /dashboard\.port/);
	assert.match(result.output, /8200/);
});

test("formatSettingsShow returns JSON fields array for all settings", () => {
	const config = {
		lanes: { maxParallel: 3 },
		gates: { requireBeforeIntegrate: true },
		agents: { worker: { model: "", thinking: "medium" } },
		dashboard: { port: 8109 },
	};

	const result = formatSettingsShow(config, { json: true });
	assert.equal(result.exitCode, 0);
	const parsed = JSON.parse(result.output);
	assert.ok(Array.isArray(parsed.fields));
	assert.equal(parsed.fields.length, 5);
	assert.deepEqual(
		parsed.fields.find((field) => field.path === "lanes.maxParallel"),
		{
			path: "lanes.maxParallel",
			label: "Max parallel lanes",
			value: 3,
			type: "number",
		},
	);
});

test("formatSettingsShow single path mode prints one value", () => {
	const config = { lanes: { maxParallel: 5 } };

	const human = formatSettingsShow(config, { path: "lanes.maxParallel" });
	assert.equal(human.exitCode, 0);
	assert.equal(human.output.trim(), "5");

	const json = formatSettingsShow(config, { path: "lanes.maxParallel", json: true });
	assert.equal(json.exitCode, 0);
	assert.deepEqual(JSON.parse(json.output), { path: "lanes.maxParallel", value: 5 });
});

test("formatSettingsShow rejects unknown path", () => {
	const config = { lanes: { maxParallel: 3 } };
	const result = formatSettingsShow(config, { path: "lanes.unknown" });
	assert.equal(result.exitCode, 1);
	assert.match(result.output, /Unknown setting path/);
});

test("buildSettingsShowFields mirrors registry order", () => {
	const config = JSON.parse(
		fs.readFileSync(path.join(REPO_ROOT, ".spine", "spine-config.json"), "utf-8"),
	);
	const fields = buildSettingsShowFields(config);
	assert.equal(fields.length, 5);
	assert.equal(fields[0].path, "lanes.maxParallel");
	assert.equal(fields[0].value, config.lanes.maxParallel);
});

test("spine settings show CLI prints editable fields from temp config", async () => {
	const projectRoot = await initGitRepo("spine-settings-show-");
	try {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.lanes.maxParallel = 7;
		config.dashboard = { port: 8110 };
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

		const result = spawnSync(process.execPath, [SPINE_BIN, "settings", "show"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /lanes\.maxParallel/);
		assert.match(result.stdout, /7/);
		assert.match(result.stdout, /8110/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings show CLI single path and JSON modes", async () => {
	const projectRoot = await initGitRepo("spine-settings-path-");
	try {
		const single = spawnSync(
			process.execPath,
			[SPINE_BIN, "settings", "show", "gates.requireBeforeIntegrate"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(single.status, 0, single.stderr);
		assert.equal(single.stdout.trim(), "true");

		const json = spawnSync(process.execPath, [SPINE_BIN, "settings", "show", "--json"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.equal(json.status, 0, json.stderr);
		const parsed = JSON.parse(json.stdout);
		assert.ok(Array.isArray(parsed.fields));
		assert.ok(parsed.fields.some((field) => field.path === "dashboard.port"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings show CLI exits 1 with suggestedCommand when config missing", async () => {
	const projectRoot = await initGitRepo("spine-settings-missing-");
	try {
		fs.rmSync(path.join(projectRoot, ".spine", "spine-config.json"));

		const result = spawnSync(process.execPath, [SPINE_BIN, "settings", "show"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});

		assert.equal(result.status, 1);
		assert.match(result.stdout, /Error:/);
		assert.match(result.stdout, /Suggested: spine init/);

		const json = spawnSync(process.execPath, [SPINE_BIN, "settings", "show", "--json"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.equal(json.status, 1);
		const parsed = JSON.parse(json.stdout);
		assert.equal(parsed.suggestedCommand, "spine init");
		assert.match(parsed.error, /not found/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
