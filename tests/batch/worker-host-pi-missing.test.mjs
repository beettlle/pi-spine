// @ts-check
/**
 * SP-801 / #299: the stub worker is opt-in. When `pi` is missing from PATH and
 * `SPINE_WORKER_STUB` is unset, runWorker must fail the launch
 * (`launch_failed`, journaled `worker.spawn_failed` with reason `pi_missing`)
 * instead of silently falling back to the stub, which could mark
 * review-level-0 tasks done with no work. An explicit `SPINE_WORKER_STUB=1`
 * and the `agentSession` backend keep working without `pi`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { createStubAgentSession } from "../../src/batch/agent-session-worker.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

const BOUNDED_STALL_CONFIG = {
	lanes: {
		stallTimeoutMinutes: 0.5,
		stallGraceAfterProgressMinutes: 0.1,
		heartbeatIntervalMinutes: 60,
	},
};

/**
 * Build a PATH that contains a working `which` but no `pi`, so
 * `commandExists("pi")` is deterministically false on every machine —
 * including dev boxes where pi is installed.
 * @returns {string} directory to use as the full PATH during the test
 */
function createPilessBinDir() {
	const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-nopi-bin-"));
	fs.writeFileSync(path.join(binDir, "which"), "#!/bin/sh\nexit 1\n", "utf-8");
	fs.chmodSync(path.join(binDir, "which"), 0o755);
	return binDir;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function readJournalEvents(projectRoot, batchId) {
	const journalFile = path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"journal",
		"events.jsonl",
	);
	assert.equal(fs.existsSync(journalFile), true, "journal file must exist");
	return fs
		.readFileSync(journalFile, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

/**
 * @param {string} root
 * @param {string} taskId
 */
function writeTaskFolder(root, taskId) {
	const taskFolder = path.join(root, "spine-tasks", `${taskId}-pi-missing`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId} — pi missing fixture\n\n## Review Level: 0\n\n## Mission\nFail closed.\n`,
		"utf-8",
	);
	return taskFolder;
}

test("pi missing and stub unset fails closed with pi_missing journal event", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pi-missing-closed-"));
	const binDir = createPilessBinDir();
	const prevPath = process.env.PATH;
	const prevStub = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const batchId = "20260928T120000";
		const taskId = "SP-801A";
		const taskFolder = writeTaskFolder(root, taskId);
		process.env.PATH = binDir;

		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			projectRoot: root,
			batchId,
			laneNumber: 1,
			taskId,
			config: BOUNDED_STALL_CONFIG,
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "launch_failed");
		assert.equal(result.exitCode, 1);
		assert.equal(result.doneFound, false);
		assert.match(result.output, /pi on PATH/);
		assert.match(result.output, /SPINE_WORKER_STUB=1/);
		assert.equal(
			fs.existsSync(path.join(taskFolder, ".DONE")),
			false,
			"no .DONE may be written",
		);

		const events = readJournalEvents(root, batchId);
		const spawnFailed = events.find((event) => event.type === "worker.spawn_failed");
		assert.ok(spawnFailed, "worker.spawn_failed event must be journaled");
		assert.equal(spawnFailed.taskId, taskId);
		assert.equal(spawnFailed.payload.reason, "pi_missing");
	} finally {
		process.env.PATH = prevPath;
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		fs.rmSync(binDir, { recursive: true, force: true });
		await rm(root, { recursive: true, force: true });
	}
});

test("explicit SPINE_WORKER_STUB=1 still runs the stub worker without pi on PATH", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pi-missing-stub-"));
	const binDir = createPilessBinDir();
	const prevPath = process.env.PATH;
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const taskId = "SP-801B";
		const taskFolder = writeTaskFolder(root, taskId);
		process.env.PATH = binDir;

		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			projectRoot: root,
			batchId: "20260928T120001",
			laneNumber: 1,
			taskId,
			config: BOUNDED_STALL_CONFIG,
		});

		assert.equal(result.ok, true);
		assert.equal(result.mode, "stub");
		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true, "stub writes .DONE");
	} finally {
		process.env.PATH = prevPath;
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		fs.rmSync(binDir, { recursive: true, force: true });
		await rm(root, { recursive: true, force: true });
	}
});

test("agentSession backend is unaffected by missing pi", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pi-missing-agentsession-"));
	const binDir = createPilessBinDir();
	const prevPath = process.env.PATH;
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevAgentStub = process.env.SPINE_AGENT_SESSION_STUB;
	delete process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_AGENT_SESSION_STUB;
	try {
		const taskId = "SP-801C";
		const taskFolder = writeTaskFolder(root, taskId);
		process.env.PATH = binDir;

		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			config: { lanes: { workerBackend: "agentSession" } },
			workerBackendDeps: {
				createAgentSession: async () => ({
					session: createStubAgentSession({ worktreePath: root, taskFolder }),
				}),
			},
		});

		assert.equal(result.ok, true);
		assert.equal(result.mode, "agentSession");
		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true, "agentSession writes .DONE");
	} finally {
		process.env.PATH = prevPath;
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevAgentStub === undefined) delete process.env.SPINE_AGENT_SESSION_STUB;
		else process.env.SPINE_AGENT_SESSION_STUB = prevAgentStub;
		fs.rmSync(binDir, { recursive: true, force: true });
		await rm(root, { recursive: true, force: true });
	}
});
