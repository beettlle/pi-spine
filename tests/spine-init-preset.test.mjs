import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { validateSpineConfig } from "../bin/spine-config.mjs";
import { runInit } from "../bin/spine-init.mjs";

async function createFixture() {
	return mkdtemp(path.join(os.tmpdir(), "spine-init-preset-test-"));
}

test("init --preset taskplane-compat --tasks-root taskplane-tasks --dry-run produces expected keys", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, [
			"--preset",
			"taskplane-compat",
			"--tasks-root",
			"taskplane-tasks",
			"--dry-run",
		]);
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);
		assert.equal(result.tasksRoot, "taskplane-tasks");

		const config = result.config;
		assert.equal(config.paths.tasksRoot, "taskplane-tasks");
		assert.equal(config.testing.test, "npm test");
		assert.equal(config.testing.build, "npm run typecheck");
		assert.equal(config.dashboard.port, 8109);
		assert.equal(config.gates.requireBeforeIntegrate, true);
		assert.equal(config.lanes.maxParallel, 3);
		assert.equal(validateSpineConfig(config), null);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("init --preset taskplane-compat defaults tasksRoot to taskplane-tasks", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, ["--preset", "taskplane-compat", "--dry-run"]);
		assert.equal(result.ok, true);
		assert.equal(result.config.paths.tasksRoot, "taskplane-tasks");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("plain init applies spine defaults without preset flag", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, ["--dry-run"]);
		assert.equal(result.ok, true);
		assert.equal(result.config.paths.tasksRoot, "spine-tasks");
		assert.equal(result.config.testing.test, "npm test");
		assert.equal(result.config.testing.build, "npm run typecheck");
		assert.equal(result.config.gates.requireBeforeIntegrate, true);
		assert.equal(result.config.lanes.maxParallel, 3);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("init rejects unknown preset", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, ["--preset", "unknown"]);
		assert.equal(result.ok, false);
		assert.match(result.error, /Unknown preset/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
