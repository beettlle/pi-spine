import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseBatchArgs } from "../../bin/spine-batch.mjs";
import {
	buildAttachedBatchResumeArgv,
	buildAttachedBatchStartArgv,
	formatDetachedBatchStartOutput,
	formatDetachedEngineOutput,
} from "../../src/batch/detached-start.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId = "TP-920") {
	const folder = path.join(projectRoot, "taskplane-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Detached smoke

## Dependencies
- **None**

## File Scope
- \`README.md\`
`,
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} tasks
 */
function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

test("parseBatchArgs defaults to detached start (attached flag off)", () => {
	const parsed = parseBatchArgs(["start", "TP-920"]);
	assert.equal(parsed.attached, false);
	assert.equal(parsed.dryRun, false);
});

test("parseBatchArgs --attached opts into foreground engine", () => {
	const parsed = parseBatchArgs(["start", "TP-920", "--attached"]);
	assert.equal(parsed.attached, true);
});

test("buildAttachedBatchStartArgv forwards scope and skip-preflight", () => {
	assert.deepEqual(buildAttachedBatchStartArgv({ scope: "TP-920 TP-921", skipPreflight: true }), [
		"batch",
		"start",
		"TP-920",
		"TP-921",
		"--attached",
		"--skip-preflight",
	]);
});

test("formatDetachedBatchStartOutput includes monitor hints", () => {
	const text = formatDetachedBatchStartOutput({
		ok: true,
		scope: "TP-920",
		batchId: "20260602T120000",
		enginePid: 4242,
		logPath: ".spine/runtime/detached-engine.log",
	});
	assert.match(text, /background/i);
	assert.match(text, /20260602T120000/);
	assert.match(text, /spine status --diagnose/);
});

test("batch start returns quickly and runs engine in background", async () => {
	const projectRoot = await initGitRepo("spine-detached-start-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-920");
		writeDependencies(projectRoot, { "TP-920": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add task"], { cwd: projectRoot, stdio: "ignore" });

		const startedAt = Date.now();
		const startResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "batch", "start", "TP-920", "--skip-preflight", "--json"],
			{ cwd: projectRoot, encoding: "utf-8", env: process.env },
		);
		const elapsedMs = Date.now() - startedAt;

		assert.equal(startResult.status, 0, startResult.stderr || startResult.stdout);
		assert.ok(elapsedMs < 15_000, `expected fast detached return, took ${elapsedMs}ms`);

		const payload = JSON.parse(startResult.stdout);
		assert.equal(payload.ok, true);
		assert.equal(payload.detached, true);
		assert.ok(payload.batchId);

		const deadline = Date.now() + 60_000;
		let terminal = false;
		while (Date.now() < deadline) {
			const { raw } = loadSpineBatchState(projectRoot);
			if (raw?.phase === "completed" || raw?.phase === "failed" || raw?.phase === "aborted") {
				terminal = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		assert.ok(terminal, "background engine should finish stub batch");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("parseBatchArgs resume defaults to detached (attached flag off)", () => {
	const parsed = parseBatchArgs(["resume"]);
	assert.equal(parsed.attached, false);
});

test("buildAttachedBatchResumeArgv forwards force", () => {
	assert.deepEqual(buildAttachedBatchResumeArgv({ force: true }), [
		"batch",
		"resume",
		"--attached",
		"--force",
	]);
});

test("formatDetachedEngineOutput includes resume wording", () => {
	const text = formatDetachedEngineOutput({
		ok: true,
		operation: "resume",
		batchId: "20260602T120000",
		taskId: "TP-920",
	});
	assert.match(text, /resuming in the background/i);
	assert.match(text, /TP-920/);
});

test("batch resume returns quickly and runs engine in background", async () => {
	const projectRoot = await initGitRepo("spine-detached-resume-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const taskId = "TP-921";
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, { [taskId]: [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add task"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260602T120001";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: path.join("taskplane-tasks", `${taskId}-smoke`),
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const startedAt = Date.now();
		const resumeResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "batch", "resume", "--json"],
			{ cwd: projectRoot, encoding: "utf-8", env: process.env },
		);
		const elapsedMs = Date.now() - startedAt;

		assert.equal(resumeResult.status, 0, resumeResult.stderr || resumeResult.stdout);
		assert.ok(elapsedMs < 15_000, `expected fast detached resume, took ${elapsedMs}ms`);

		const payload = JSON.parse(resumeResult.stdout);
		assert.equal(payload.ok, true);
		assert.equal(payload.detached, true);
		assert.equal(payload.operation, "resume");
		assert.equal(payload.batchId, batchId);

		const deadline = Date.now() + 60_000;
		let terminal = false;
		while (Date.now() < deadline) {
			const { raw } = loadSpineBatchState(projectRoot);
			if (raw?.phase === "completed" || raw?.phase === "failed" || raw?.phase === "aborted") {
				terminal = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		assert.ok(terminal, "background engine should finish resumed stub batch");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
