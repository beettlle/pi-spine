import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	DEFAULT_TASKS_ROOT,
	ensureGitignoreEntries,
	runInit,
	SPINE_GITIGNORE_ENTRIES,
} from "../bin/spine-init.mjs";
import { validateSpineConfig } from "../bin/spine-config.mjs";

async function createFixture() {
	const dir = await mkdtemp(path.join(os.tmpdir(), "spine-init-test-"));
	return dir;
}

function readGitignoreLines(projectRoot) {
	const gitignorePath = path.join(projectRoot, ".gitignore");
	if (!fs.existsSync(gitignorePath)) return [];
	return fs.readFileSync(gitignorePath, "utf-8").split(/\r?\n/).map((line) => line.trim());
}

test("fresh init creates config, agents, tasks root, and gitignore entries", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, []);
		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);

		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		assert.ok(fs.existsSync(configPath));
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		assert.equal(config.paths.tasksRoot, DEFAULT_TASKS_ROOT);
		assert.equal(config.testing.test, "npm run typecheck && npm test");
		assert.equal(config.gates.requireBeforeIntegrate, true);
		assert.equal(config.lanes.maxParallel, 3);
		assert.equal(config.dashboard.port, 8109);
		assert.equal(validateSpineConfig(config), null);

		for (const agentFile of ["worker.md", "reviewer.md", "supervisor.md"]) {
			assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "agents", agentFile)));
		}

		assert.ok(fs.existsSync(path.join(projectRoot, DEFAULT_TASKS_ROOT)));

		const gitignoreLines = readGitignoreLines(projectRoot);
		for (const entry of SPINE_GITIGNORE_ENTRIES) {
			assert.ok(gitignoreLines.includes(entry));
		}
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("init without --force refuses when spine-config.json exists", async () => {
	const projectRoot = await createFixture();
	try {
		const first = runInit(projectRoot, []);
		assert.equal(first.ok, true);

		const second = runInit(projectRoot, []);
		assert.equal(second.ok, false);
		assert.match(second.error, /already initialized/i);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("--tasks-root taskplane-tasks sets paths.tasksRoot correctly", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, ["--tasks-root", "taskplane-tasks"]);
		assert.equal(result.ok, true);

		const config = JSON.parse(
			fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8"),
		);
		assert.equal(config.paths.tasksRoot, "taskplane-tasks");
		assert.ok(fs.existsSync(path.join(projectRoot, "taskplane-tasks")));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("--dry-run makes no filesystem changes", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, ["--dry-run"]);
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);

		assert.equal(fs.existsSync(path.join(projectRoot, ".spine")), false);
		assert.equal(fs.existsSync(path.join(projectRoot, ".gitignore")), false);
		assert.equal(fs.existsSync(path.join(projectRoot, DEFAULT_TASKS_ROOT)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("ensureGitignoreEntries appends only missing entries", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-gitignore-"));
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), ".spine/runtime/\n", "utf-8");

		const result = ensureGitignoreEntries(projectRoot, { dryRun: false });
		assert.ok(result.added.length > 0);
		assert.equal(result.added.includes(".spine/runtime/"), false);

		const lines = readGitignoreLines(projectRoot);
		for (const entry of SPINE_GITIGNORE_ENTRIES) {
			assert.ok(lines.includes(entry));
		}
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});
