/**
 * SP-619 — batch-meta.json persisted at batch start (FR-REL240-03 / #126).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	BATCH_META_DEFAULT_MODE,
	BATCH_META_SCHEMA_VERSION,
	batchMetaPath,
	normalizeBatchMetaTasksRoot,
	saveBatchMetaRuntimeArtifact,
} from "../../src/batch/batch-meta.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId = "TP-619") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: "Batch meta persist smoke",
			fileScope: "README.md",
			mission: "Assert batch-meta.json at start.",
		}),
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

test("saveBatchMetaRuntimeArtifact writes required topology keys atomically", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-batch-meta-"));
	try {
		const batchId = "20260711T120000";
		const { path: filePath, meta } = saveBatchMetaRuntimeArtifact({
			projectRoot,
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			totalWaves: 2,
			mode: "batch",
			tasksRoot: path.join(projectRoot, "spine-tasks"),
			wavePlan: [
				["TP-A", "TP-B"],
				["TP-C"],
			],
		});

		assert.equal(filePath, batchMetaPath(projectRoot, batchId));
		assert.equal(fs.existsSync(filePath), true);
		const onDisk = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		assert.equal(onDisk.schemaVersion, BATCH_META_SCHEMA_VERSION);
		assert.equal(onDisk.batchId, batchId);
		assert.equal(onDisk.baseBranch, "main");
		assert.equal(onDisk.orchBranch, `orch/spine-${batchId}`);
		assert.equal(onDisk.totalWaves, 2);
		assert.equal(onDisk.mode, BATCH_META_DEFAULT_MODE);
		assert.equal(onDisk.tasksRoot, "spine-tasks");
		assert.deepEqual(onDisk.wavePlan, [
			["TP-A", "TP-B"],
			["TP-C"],
		]);
		assert.equal(typeof onDisk.createdAt, "number");
		assert.equal(meta.tasksRoot, "spine-tasks");
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("normalizeBatchMetaTasksRoot keeps portable relative paths", () => {
	const root = "/tmp/project";
	assert.equal(normalizeBatchMetaTasksRoot(root, "spine-tasks"), "spine-tasks");
	assert.equal(normalizeBatchMetaTasksRoot(root, path.join(root, "spine-tasks")), "spine-tasks");
	assert.equal(normalizeBatchMetaTasksRoot(root, "/elsewhere/tasks"), "/elsewhere/tasks");
});

test("startBatch persists batch-meta.json with required keys", async () => {
	const projectRoot = await initGitRepo("spine-batch-meta-persist-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevWorker = process.env.SPINE_IS_WORKER;
	process.env.SPINE_WORKER_STUB = "1";
	delete process.env.SPINE_IS_WORKER;
	try {
		writeSmokeTask(projectRoot, "TP-619");
		writeDependencies(projectRoot, { "TP-619": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add smoke task"], { cwd: projectRoot, stdio: "ignore" });

		const result = await startBatch({
			projectRoot,
			scope: "TP-619",
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const batchId = String(result.batchId ?? "");
		assert.ok(batchId);

		const metaPath = batchMetaPath(projectRoot, batchId);
		assert.equal(fs.existsSync(metaPath), true, `expected ${metaPath}`);
		const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

		for (const key of [
			"baseBranch",
			"orchBranch",
			"totalWaves",
			"mode",
			"tasksRoot",
			"wavePlan",
		]) {
			assert.ok(key in meta, `missing key ${key}`);
		}
		assert.equal(meta.schemaVersion, BATCH_META_SCHEMA_VERSION);
		assert.equal(meta.batchId, batchId);
		assert.equal(meta.baseBranch, "main");
		assert.equal(meta.orchBranch, `orch/spine-${batchId}`);
		assert.equal(meta.totalWaves, 1);
		assert.equal(meta.mode, "batch");
		assert.equal(meta.tasksRoot, "spine-tasks");
		assert.deepEqual(meta.wavePlan, [["TP-619"]]);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prevWorker;
		await destroyGitRepo(projectRoot);
	}
});
