/**
 * SP-708 (#253) — worker runner flushes pi stdout/stderr when pi exits 0
 * without creating .DONE, mirroring the non-zero exit path.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildDoneMissingPiOutputFlush } from "../../bin/spine-worker-runner.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNNER_PATH = path.join(REPO_ROOT, "bin", "spine-worker-runner.mjs");

async function writeSmokeTask(root, taskId = "SP-708") {
	const taskFolder = path.join(root, "spine-tasks", taskId);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`${minimalValidPromptMarkdown(taskId, { fileScope: "src/smoke.txt" })}\n\n## Review Level: 0\n`,
		"utf-8",
	);
	return taskFolder;
}

/**
 * Fake `pi` on PATH: `--version` exits 0; worker invocation prints markers to
 * stdout/stderr and exits 0 without writing .DONE.
 */
function writeFakePi(binDir) {
	const piPath = path.join(binDir, "pi");
	fs.writeFileSync(
		piPath,
		[
			"#!/bin/sh",
			'if [ "$1" = "--version" ]; then echo "pi 0.0.0-fake"; exit 0; fi',
			'echo "FAKE_PI_STDOUT_MARKER"',
			'echo "FAKE_PI_STDERR_MARKER" >&2',
			"exit 0",
			"",
		].join("\n"),
		{ mode: 0o755 },
	);
	return piPath;
}

test("runner flushes pi stdout/stderr and exits 1 when pi exits 0 without .DONE", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-done-missing-flush-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		const taskFolder = await writeSmokeTask(root, "SP-708-flush");

		const result = spawnSync(process.execPath, [RUNNER_PATH], {
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
				SPINE_TASK_FOLDER: taskFolder,
				SPINE_WORKTREE: root,
				SPINE_PROJECT_ROOT: root,
			},
		});

		assert.equal(result.status, 1, `expected exit 1, got ${result.status}: ${result.stderr}`);
		assert.match(result.stderr, /pi exited but \.DONE was not created/);
		assert.match(result.stderr, /FAKE_PI_STDERR_MARKER/);
		assert.match(result.stdout, /FAKE_PI_STDOUT_MARKER/);
		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runner still exits 0 when fake pi writes .DONE (no flush regression)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-done-present-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		const taskFolder = await writeSmokeTask(root, "SP-708-done");
		fs.writeFileSync(
			path.join(binDir, "pi"),
			[
				"#!/bin/sh",
				'if [ "$1" = "--version" ]; then echo "pi 0.0.0-fake"; exit 0; fi',
				`touch "${path.join(taskFolder, ".DONE")}"`,
				"exit 0",
				"",
			].join("\n"),
			{ mode: 0o755 },
		);

		const result = spawnSync(process.execPath, [RUNNER_PATH], {
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
				SPINE_TASK_FOLDER: taskFolder,
				SPINE_WORKTREE: root,
				SPINE_PROJECT_ROOT: root,
			},
		});

		assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildDoneMissingPiOutputFlush caps streams at lanes.workerOutputMaxBytes", () => {
	const huge = "x".repeat(1024 * 1024);
	const flush = buildDoneMissingPiOutputFlush(
		{ stdout: huge, stderr: huge },
		{ lanes: { workerOutputMaxBytes: 4096 } },
	);
	assert.ok(Buffer.byteLength(flush.stdout, "utf-8") <= 4096);
	assert.ok(Buffer.byteLength(flush.stderr, "utf-8") <= 4096);
	assert.match(flush.stdout, /worker output truncated/);
	assert.match(flush.stderr, /worker output truncated/);
});

test("buildDoneMissingPiOutputFlush passes small output through uncapped", () => {
	const flush = buildDoneMissingPiOutputFlush({ stdout: "out\n", stderr: "err\n" });
	assert.equal(flush.stdout, "out\n");
	assert.equal(flush.stderr, "err\n");
});
