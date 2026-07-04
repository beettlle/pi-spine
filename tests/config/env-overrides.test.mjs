import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadSpineConfig, loadSpineConfigFile } from "../../bin/spine-config.mjs";
import { runSpinePlan } from "../../bin/spine-plan.mjs";
import { runDoctorChecks } from "../../bin/spine.mjs";
import {
	applyEnvOverrides,
	normalizeTasksRootFromEnv,
	resolveTasksRootPath,
} from "../../src/config/env-overrides.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

const BASE_CONFIG = {
	configVersion: 1,
	project: { name: "env-test" },
	paths: { tasksRoot: "taskplane-tasks" },
	baseBranch: "main",
	testing: { commands: ["npm test"] },
	agents: { worker: { model: "inherit", thinking: "medium" } },
	lanes: { maxParallel: 3, queueExcess: true },
	gates: { requireBeforeIntegrate: true },
};

test("normalizeTasksRootFromEnv accepts relative and rejects parent traversal", () => {
	const rel = normalizeTasksRootFromEnv("./alt-tasks/", "/proj");
	assert.equal(rel.ok, true);
	if (rel.ok) assert.equal(rel.normalized, "alt-tasks");

	const bad = normalizeTasksRootFromEnv("../outside", "/proj");
	assert.equal(bad.ok, false);

	const abs = normalizeTasksRootFromEnv("/tmp/spine-tasks", "/proj");
	assert.equal(abs.ok, true);
	if (abs.ok) assert.equal(abs.normalized, path.normalize("/tmp/spine-tasks"));
});

test("applyEnvOverrides: SPINE_MAX_LANES overrides file value", () => {
	const result = applyEnvOverrides(structuredClone(BASE_CONFIG), "/proj", {
		SPINE_MAX_LANES: "5",
	});
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.config.lanes.maxParallel, 5);
		assert.equal(result.sources["lanes.maxParallel"], "env");
		assert.equal(result.envVars["lanes.maxParallel"], "SPINE_MAX_LANES");
	}
});

test("applyEnvOverrides: SPINE_TASKS_ROOT overrides paths.tasksRoot", () => {
	const result = applyEnvOverrides(structuredClone(BASE_CONFIG), "/proj", {
		SPINE_TASKS_ROOT: "custom-tasks",
	});
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.config.paths.tasksRoot, "custom-tasks");
		assert.equal(result.sources["paths.tasksRoot"], "env");
	}
});

test("applyEnvOverrides rejects invalid SPINE_MAX_LANES", () => {
	const result = applyEnvOverrides(structuredClone(BASE_CONFIG), "/proj", {
		SPINE_MAX_LANES: "99",
	});
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.error.code, "CONFIG_ENV_INVALID");
		assert.match(result.error.message, /SPINE_MAX_LANES/);
	}
});

test("loadSpineConfig applies env overrides after file load", async () => {
	const projectRoot = await initGitRepo("env-load-");
	const prev = process.env.SPINE_MAX_LANES;
	process.env.SPINE_MAX_LANES = "2";
	try {
		const loaded = loadSpineConfig(projectRoot);
		assert.equal(loaded.error, null);
		assert.equal(loaded.config?.lanes.maxParallel, 2);
		assert.equal(loaded.sources?.["lanes.maxParallel"], "env");

		const fileOnly = loadSpineConfigFile(projectRoot);
		assert.equal(fileOnly.config?.lanes.maxParallel, 3);
	} finally {
		if (prev === undefined) delete process.env.SPINE_MAX_LANES;
		else process.env.SPINE_MAX_LANES = prev;
		await destroyGitRepo(projectRoot);
	}
});

test("SPINE_TASKS_ROOT env discovers tasks under alternate root in plan", async () => {
	const projectRoot = await initGitRepo("env-plan-");
	const altRoot = path.join(projectRoot, "alt-tasks");
	fs.mkdirSync(altRoot, { recursive: true });
	const taskDir = path.join(altRoot, "TP-900-env-smoke");
	fs.mkdirSync(taskDir);
	fs.writeFileSync(
		path.join(taskDir, "PROMPT.md"),
		minimalValidPromptMarkdown("TP-900", {
			title: "Env smoke",
			fileScope: "src/env-smoke.txt",
		}),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(altRoot, "dependencies.json"),
		JSON.stringify({ schemaVersion: 1, tasks: {} }, null, 2),
		"utf-8",
	);

	const prev = process.env.SPINE_TASKS_ROOT;
	process.env.SPINE_TASKS_ROOT = "alt-tasks";
	try {
		const { plan } = await runSpinePlan({ projectRoot, scope: "all", json: true });
		assert.ok(plan.tasks && Object.keys(plan.tasks).length >= 1);
		assert.ok(
			Object.values(plan.tasks).some((t) => String(t.title ?? "").includes("Env smoke") || t.taskId === "TP-900"),
		);
		assert.equal(resolveTasksRootPath(projectRoot, loadSpineConfig(projectRoot).config), altRoot);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASKS_ROOT;
		else process.env.SPINE_TASKS_ROOT = prev;
		await destroyGitRepo(projectRoot);
	}
});

test("spine settings show reports env source for overridden lanes.maxParallel", async () => {
	const projectRoot = await initGitRepo("env-settings-show-");
	const prev = process.env.SPINE_MAX_LANES;
	process.env.SPINE_MAX_LANES = "4";
	try {
		const result = spawnSync(process.execPath, [SPINE_BIN, "settings", "show"], {
			cwd: projectRoot,
			encoding: "utf-8",
			env: { ...process.env, SPINE_MAX_LANES: "4" },
		});
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Effective config/);
		assert.match(result.stdout, /SPINE_MAX_LANES/);
		assert.match(result.stdout, /source: env/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_MAX_LANES;
		else process.env.SPINE_MAX_LANES = prev;
		await destroyGitRepo(projectRoot);
	}
});

test("runDoctorChecks lists effective config with env source", async () => {
	const projectRoot = await initGitRepo("env-doctor-");
	const prev = process.env.SPINE_TASKS_ROOT;
	process.env.SPINE_TASKS_ROOT = "taskplane-tasks";
	try {
		const result = runDoctorChecks(projectRoot);
		const tasksRootCheck = result.checks.find((c) => c.label === "paths.tasksRoot (effective)");
		assert.ok(tasksRootCheck, "expected paths.tasksRoot (effective) check");
		assert.match(tasksRootCheck.detail, /source: env/);
		assert.match(tasksRootCheck.detail, /SPINE_TASKS_ROOT/);
		assert.match(tasksRootCheck.detail, /taskplane-tasks/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASKS_ROOT;
		else process.env.SPINE_TASKS_ROOT = prev;
		await destroyGitRepo(projectRoot);
	}
});
