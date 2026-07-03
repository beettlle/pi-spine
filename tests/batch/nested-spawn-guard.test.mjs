import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { detectNestedWorkerContext, startBatch } from "../../src/batch/engine.mjs";
import { buildWorkerChildEnv } from "../../src/batch/worker-host.mjs";
import { initGitRepo, destroyGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { execFileSync } from "node:child_process";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId = "TP-999") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} tasks
 */
function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {string} message
 */
function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot });
	execFileSync("git", ["commit", "-m", message, "--allow-empty"], {
		cwd: projectRoot,
	});
}

// --- detectNestedWorkerContext unit tests ---

test("detectNestedWorkerContext returns reason when SPINE_IS_WORKER=1", () => {
	const prev = process.env.SPINE_IS_WORKER;
	try {
		process.env.SPINE_IS_WORKER = "1";
		const result = detectNestedWorkerContext("/tmp/normal-dir");
		assert.ok(result !== null, "should detect worker env");
		assert.match(result, /SPINE_IS_WORKER/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
	}
});

test("detectNestedWorkerContext returns reason when projectRoot is inside .worktrees/spine-*", () => {
	const prev = process.env.SPINE_IS_WORKER;
	try {
		delete process.env.SPINE_IS_WORKER;
		const worktreeRoot = "/some/repo/.worktrees/spine-20260703T123456/lane-1";
		const result = detectNestedWorkerContext(worktreeRoot);
		assert.ok(result !== null, "should detect worktree projectRoot");
		assert.match(result, /\.worktrees\/spine-/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
	}
});

test("detectNestedWorkerContext returns null for normal projectRoot without worker env", () => {
	const prev = process.env.SPINE_IS_WORKER;
	try {
		delete process.env.SPINE_IS_WORKER;
		const result = detectNestedWorkerContext("/some/normal/project");
		assert.equal(result, null);
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
	}
});

// --- startBatch integration tests ---

test("startBatch returns error when SPINE_IS_WORKER=1", async () => {
	const prev = process.env.SPINE_IS_WORKER;
	try {
		process.env.SPINE_IS_WORKER = "1";
		const result = await startBatch({
			projectRoot: os.tmpdir(),
			scope: "all",
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "nested_batch_spawn_blocked");
		assert.match(result.output, /Nested batch start blocked/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
	}
});

test("startBatch returns error when projectRoot is inside .worktrees/spine-*", async () => {
	const prev = process.env.SPINE_IS_WORKER;
	const worktreeParent = path.join(os.tmpdir(), ".worktrees");
	fs.mkdirSync(worktreeParent, { recursive: true });
	const worktreeDir = await mkdtemp(
		path.join(worktreeParent, "spine-guard-test-"),
	);
	try {
		delete process.env.SPINE_IS_WORKER;
		const result = await startBatch({
			projectRoot: worktreeDir,
			scope: "all",
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "nested_batch_spawn_blocked");
		assert.match(result.output, /\.worktrees\/spine-/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
		await rm(worktreeDir, { recursive: true, force: true });
	}
});

test("startBatch succeeds normally (no env, normal CWD) — regression", async () => {
	const prev = process.env.SPINE_IS_WORKER;
	const prevStub = process.env.SPINE_WORKER_STUB;
	try {
		delete process.env.SPINE_IS_WORKER;
		process.env.SPINE_WORKER_STUB = "1";
		const projectRoot = await initGitRepo("spine-nested-guard-regression-");
		try {
			writeSmokeTask(projectRoot, "TP-888");
			writeDependencies(projectRoot, { "TP-888": [] });
			execCommit(projectRoot, "add smoke task");

			const result = await startBatch({
				projectRoot,
				scope: "TP-888",
				skipPreflight: true,
			});
			assert.equal(result.ok, true, result.output ?? result.error);
		} finally {
			await destroyGitRepo(projectRoot);
		}
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
	}
});

// --- Worker env test ---

test("buildWorkerChildEnv includes SPINE_IS_WORKER=1", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-worker-env-guard-"));
	try {
		const env = buildWorkerChildEnv({
			taskFolder: path.join(projectRoot, "spine-tasks", "SP-482-test"),
			worktreePath: path.join(projectRoot, "worktree"),
			projectRoot,
			batchId: "batch-482",
			laneNumber: 1,
			taskId: "SP-482",
			config: {},
		});
		assert.equal(env.SPINE_IS_WORKER, "1");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
