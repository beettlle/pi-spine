import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	buildConstitutionMd,
	buildContextMd,
	DEFAULT_NEXT_TASK_ID,
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
		assert.deepEqual(config.referenceDocs, ["docs/constitution.md"]);
		assert.equal(validateSpineConfig(config), null);

		const constitutionPath = path.join(projectRoot, "docs", "constitution.md");
		assert.ok(fs.existsSync(constitutionPath));
		const constitutionMd = fs.readFileSync(constitutionPath, "utf-8");
		assert.match(constitutionMd, /# .+ — Constitution/);
		assert.match(constitutionMd, /## Guiding principles/);
		assert.match(constitutionMd, /## Non-negotiable rules/);

		for (const agentFile of ["worker.md", "reviewer.md", "supervisor.md"]) {
			assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "agents", agentFile)));
		}

		assert.ok(fs.existsSync(path.join(projectRoot, DEFAULT_TASKS_ROOT)));

		const contextPath = path.join(projectRoot, DEFAULT_TASKS_ROOT, "CONTEXT.md");
		assert.ok(fs.existsSync(contextPath));
		const contextMd = fs.readFileSync(contextPath, "utf-8");
		assert.match(contextMd, new RegExp(`\\*\\*Next Task ID:\\*\\* ${DEFAULT_NEXT_TASK_ID}`));
		assert.match(contextMd, /Phase 0 — Bootstrap/);
		assert.match(contextMd, /operator-runbook\.md/);
		assert.match(contextMd, /## Execution policy/);

		const gitignoreLines = readGitignoreLines(projectRoot);
		for (const entry of SPINE_GITIGNORE_ENTRIES) {
			assert.ok(gitignoreLines.includes(entry));
		}
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("init skips constitution.md when it already exists without --force", async () => {
	const projectRoot = await createFixture();
	try {
		fs.mkdirSync(path.join(projectRoot, "docs"), { recursive: true });
		const constitutionPath = path.join(projectRoot, "docs", "constitution.md");
		fs.writeFileSync(constitutionPath, "# Custom constitution\n", "utf-8");

		const result = runInit(projectRoot, []);
		assert.equal(result.ok, true);
		assert.equal(fs.readFileSync(constitutionPath, "utf-8"), "# Custom constitution\n");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("buildConstitutionMd substitutes project title from directory name", () => {
	const projectRoot = path.join(os.tmpdir(), "my-consumer-app");
	const constitutionMd = buildConstitutionMd(projectRoot);
	assert.match(constitutionMd, /# my-consumer-app — Constitution/);
	assert.match(constitutionMd, /## Guiding principles/);
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

test("init skips CONTEXT.md when it already exists without --force", async () => {
	const projectRoot = await createFixture();
	try {
		fs.mkdirSync(path.join(projectRoot, DEFAULT_TASKS_ROOT), { recursive: true });
		const contextPath = path.join(projectRoot, DEFAULT_TASKS_ROOT, "CONTEXT.md");
		fs.writeFileSync(contextPath, "# Custom\n**Next Task ID:** CUSTOM-001\n", "utf-8");

		const result = runInit(projectRoot, []);
		assert.equal(result.ok, true);
		assert.equal(fs.readFileSync(contextPath, "utf-8"), "# Custom\n**Next Task ID:** CUSTOM-001\n");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("init --force overwrites existing CONTEXT.md", async () => {
	const projectRoot = await createFixture();
	try {
		const first = runInit(projectRoot, []);
		assert.equal(first.ok, true);

		const contextPath = path.join(projectRoot, DEFAULT_TASKS_ROOT, "CONTEXT.md");
		fs.writeFileSync(contextPath, "# stale\n", "utf-8");

		const second = runInit(projectRoot, ["--force"]);
		assert.equal(second.ok, true);
		const contextMd = fs.readFileSync(contextPath, "utf-8");
		assert.match(contextMd, new RegExp(`\\*\\*Next Task ID:\\*\\* ${DEFAULT_NEXT_TASK_ID}`));
		assert.doesNotMatch(contextMd, /# stale/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("buildContextMd substitutes project title from directory name", () => {
	const projectRoot = path.join(os.tmpdir(), "my-consumer-app");
	const contextMd = buildContextMd(projectRoot);
	assert.match(contextMd, /# my-consumer-app — Context/);
	assert.match(contextMd, /\*\*Next Task ID:\*\* SP-001/);
});

test("--dry-run plans CONTEXT.md create without writing files", async () => {
	const projectRoot = await createFixture();
	try {
		const result = runInit(projectRoot, ["--dry-run"]);
		assert.equal(result.ok, true);

		const contextAction = result.actions.find((a) => a.path?.endsWith("CONTEXT.md"));
		assert.ok(contextAction);
		assert.equal(contextAction.action, "create");

		assert.equal(fs.existsSync(path.join(projectRoot, DEFAULT_TASKS_ROOT, "CONTEXT.md")), false);
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
