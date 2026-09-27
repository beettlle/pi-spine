// @ts-check
/**
 * Worker spawn hardening (SP-787 / #306):
 * 1. a failed spawn (EACCES) classifies `launch_failed` without an unhandled
 *    'error' event — the engine keeps running;
 * 2. collected worker output stays bounded regardless of child runtime;
 * 3. the execution-only `.DONE` path passes the path as a positional shell
 *    parameter, so hostile task-folder names run no shell code;
 * 4. the live log is append-only (never re-read per chunk) and bounded at
 *    twice `workerLiveLogMaxBytes`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";

import { runWorker } from "../../src/batch/worker-host.mjs";
import { collectChildOutput } from "../../src/batch/worker-spawn.mjs";
import {
	appendWorkerLiveLogChunk,
	resolveWorkerOutputConfig,
} from "../../src/batch/worker-output.mjs";

const BOUNDED_STALL_CONFIG = {
	lanes: {
		stallTimeoutMinutes: 0.05,
		stallGraceAfterProgressMinutes: 0.01,
		heartbeatIntervalMinutes: 60,
	},
};

/**
 * Minimal child double: real EventEmitter so `error`/`close` semantics and
 * `exitCode` assignment behave like a ChildProcess.
 */
function createFakeChild() {
	/** @type {any} */
	const child = new EventEmitter();
	child.exitCode = null;
	child.pid = 424242;
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	return child;
}

test("non-executable launch script yields launch_failed and the engine survives", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-spawn-eacces-"));
	const prevStub = process.env.SPINE_WORKER_STUB;
	try {
		const projectRoot = path.join(root, "project");
		const worktreePath = path.join(root, "worktree");
		const taskId = "SP-787A";
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-eacces`);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");
		// Conventional launch script exists but is NOT executable → EACCES at spawn.
		fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
		const launchScript = path.join(projectRoot, "scripts", "spine-worker-launch.sh");
		fs.writeFileSync(launchScript, "#!/bin/sh\necho should never run\n", "utf-8");
		fs.chmodSync(launchScript, 0o644);

		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId: "20260927T000000",
			laneNumber: 1,
			taskId,
			config: BOUNDED_STALL_CONFIG,
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "launch_failed");
		assert.equal(result.exitCode, 127);
		assert.equal(result.doneFound, false);

		// The engine keeps running: a follow-up stub worker in the same process
		// completes normally (an unhandled 'error' event would have crashed us).
		const projectRoot2 = path.join(root, "project2");
		const worktreePath2 = path.join(root, "worktree2");
		const taskId2 = "SP-787B";
		const taskFolder2 = path.join(worktreePath2, "spine-tasks", `${taskId2}-ok`);
		fs.mkdirSync(taskFolder2, { recursive: true });
		fs.writeFileSync(path.join(taskFolder2, "PROMPT.md"), "# Task\n\n## Review Level: 0\n", "utf-8");
		process.env.SPINE_WORKER_STUB = "1";
		const second = await runWorker({
			worktreePath: worktreePath2,
			taskFolder: taskFolder2,
			projectRoot: projectRoot2,
			batchId: "20260927T000001",
			laneNumber: 2,
			taskId: taskId2,
			config: BOUNDED_STALL_CONFIG,
		});
		assert.equal(second.ok, true);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("collectChildOutput keeps only the bounded tail, stdout-then-stderr", async () => {
	const cap = 1024;
	const child = createFakeChild();
	const done = collectChildOutput(child, null, cap);
	child.stdout.emit("data", Buffer.from("x".repeat(3000)));
	child.stdout.emit("data", Buffer.from("y".repeat(3000)));
	child.stderr.emit("data", Buffer.from("E".repeat(2000)));
	child.emit("close", 0);
	const result = await done;

	assert.ok(Buffer.byteLength(result.output, "utf-8") <= cap, "output exceeds the cap");
	assert.equal(result.spawnError, undefined);
	// Combined tail keeps the LAST `cap` bytes overall → 1024 stderr E's.
	assert.equal(result.output, "E".repeat(cap));
});

test("collectChildOutput defaults to the worker output cap", async () => {
	const child = createFakeChild();
	const done = collectChildOutput(child, null);
	child.stdout.emit("data", Buffer.from("x".repeat(300_000)));
	child.emit("close", 0);
	const result = await done;

	assert.ok(
		Buffer.byteLength(result.output, "utf-8") <= 262_144,
		"default cap (worker output maxBytes) not applied",
	);
});

test("spawn error resolves once with spawnError and wins over the later close", async () => {
	const child = createFakeChild();
	const done = collectChildOutput(child, null, 512);
	child.stdout.emit("data", Buffer.from("partial output\n"));
	child.emit("error", new Error("spawn scripts/spine-worker-launch.sh EACCES"));
	child.emit("close", null); // synthetic close after a failed spawn
	const result = await done;

	assert.equal(result.exitCode, 127);
	assert.equal(result.spawnError, true);
	assert.match(result.output, /EACCES/);
	assert.match(result.output, /partial output/);
	assert.equal(child.exitCode, 127, "handle exitCode flagged so poll loops settle");
});

test("execution-only .DONE is positional: hostile task folder runs no shell code", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-spawn-inject-"));
	try {
		const worktreePath = path.join(root, "worktree");
		const evilFolderName = "x$(touch pwn)";
		const taskFolder = path.join(worktreePath, "spine-tasks", evilFolderName);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			"# Task\n\n**Type:** execute\n\n## Review Level: 0\n\n## Contract\n\n| Field | Value |\n|-------|-------|\n| testCommand | echo done |\n",
			"utf-8",
		);

		const result = await runWorker({
			worktreePath,
			taskFolder,
			batchId: "20260927T000002",
			laneNumber: 1,
			taskId: "SP-787C",
			config: BOUNDED_STALL_CONFIG,
		});

		assert.equal(result.ok, true);
		assert.ok(
			fs.existsSync(path.join(taskFolder, ".DONE")),
			".DONE must be written inside the hostile folder",
		);
		assert.equal(fs.existsSync(path.join(worktreePath, "pwn")), false, "no shell side effect");
		assert.equal(fs.existsSync(path.join(root, "pwn")), false, "no shell side effect in tmp root");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("live log is append-only (no per-chunk reads) and bounded at twice the cap", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-spawn-livelog-"));
	const realReadFileSync = fs.readFileSync;
	try {
		const logPath = path.join(root, "worker-live.log");
		const outputConfig = resolveWorkerOutputConfig({
			lanes: { workerLiveLogMaxBytes: 64 },
		});

		let readCalls = 0;
		fs.readFileSync = (/** @type {any[]} */ ...args) => {
			readCalls += 1;
			return realReadFileSync(...args);
		};

		// Hot path: two appends stay under 2× cap → pure appends, zero reads.
		appendWorkerLiveLogChunk({ logPath, rawChunk: `chunk-0 ${"y".repeat(40)}\n`, outputConfig });
		const inoAfterFirst = fs.statSync(logPath).ino;
		appendWorkerLiveLogChunk({ logPath, rawChunk: `chunk-1 ${"y".repeat(40)}\n`, outputConfig });
		assert.equal(fs.statSync(logPath).ino, inoAfterFirst, "hot path must not rewrite the file");
		assert.equal(readCalls, 0, "hot path must not read the log back");

		// Grow past 2× cap repeatedly: every call leaves the file ≤ 2× cap and
		// only the rare truncation path rewrites (read) the file.
		for (let i = 2; i < 10; i++) {
			appendWorkerLiveLogChunk({ logPath, rawChunk: `chunk-${i} ${"y".repeat(40)}\n`, outputConfig });
			const size = fs.statSync(logPath).size;
			assert.ok(size <= 64 * 2, `live log size ${size} exceeds twice the cap`);
		}
		assert.ok(readCalls > 0, "over-cap truncation should exercise the rewrite path");
		assert.ok(readCalls <= 4, `expected few truncation rewrites, saw ${readCalls}`);

		const content = realReadFileSync(logPath, "utf-8");
		assert.match(content, /worker output truncated/);
		assert.match(content, /chunk-9/, "tail of the output is kept");
	} finally {
		fs.readFileSync = realReadFileSync;
		await rm(root, { recursive: true, force: true });
	}
});
