import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chmodSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	REVIEW_TIMEOUT_REASON,
	runStepReview,
} from "../../src/batch/review.mjs";
import { resolveReviewSpawnTimeoutMs } from "../../src/batch/task-stall-budget.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

/**
 * @param {string} root
 * @param {{ withDone?: boolean }} [options]
 */
function writeFinalReviewTask(root, options = {}) {
	const taskFolder = path.join(root, "spine-tasks", "SP-269-stall");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: SP-269 — Stall fixture

**Size:** M

## Review Level: 2 (Plan and Code)

## Mission
Fixture for hung final review recovery.

## File Scope
- \`src/fixture.txt\`

## Steps
### Step 3: Delivery
- [ ] done
`,
		"utf-8",
	);
	if (options.withDone) {
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "ok\n", "utf-8");
	}
	return taskFolder;
}

/**
 * @param {string} dir
 */
async function installHangingPiShim(dir) {
	const shimPath = path.join(dir, "pi");
	await writeFile(
		shimPath,
		"#!/usr/bin/env node\nsetInterval(() => {}, 1_000);\n",
		"utf-8",
	);
	chmodSync(shimPath, 0o755);
}

test("resolveReviewSpawnTimeoutMs aligns with stall budget for M tasks", () => {
	const prev = process.env.SPINE_WORKER_PI_TIMEOUT_MS;
	const prevReview = process.env.SPINE_REVIEW_TIMEOUT_MS;
	delete process.env.SPINE_WORKER_PI_TIMEOUT_MS;
	delete process.env.SPINE_REVIEW_TIMEOUT_MS;
	try {
		const timeoutMs = resolveReviewSpawnTimeoutMs({
			config: { lanes: { stallTimeoutMinutes: 120 } },
			taskSize: "M",
		});
		assert.equal(timeoutMs, 180 * 60 * 1000);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_PI_TIMEOUT_MS;
		else process.env.SPINE_WORKER_PI_TIMEOUT_MS = prev;
		if (prevReview === undefined) delete process.env.SPINE_REVIEW_TIMEOUT_MS;
		else process.env.SPINE_REVIEW_TIMEOUT_MS = prevReview;
	}
});

test("runStepReview journals review.failed with review_timeout on hung spawn", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-timeout-"));
	const batchId = "20260617T164948";
	const taskId = "SP-269";
	const shimDir = await mkdtemp(path.join(os.tmpdir(), "spine-pi-shim-"));
	const taskFolder = writeFinalReviewTask(projectRoot);

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [{ taskId, laneNumber: 4, status: "running", taskFolder }],
		lanes: [{ laneNumber: 4, laneId: "lane-4", taskIds: [taskId] }],
	});
	saveSpineBatchState(projectRoot, state);

	const prevPath = process.env.PATH;
	const prevTimeout = process.env.SPINE_REVIEW_TIMEOUT_MS;
	const prevWorkerRunner = process.env.SPINE_WORKER_RUNNER;

	await installHangingPiShim(shimDir);
	process.env.PATH = `${shimDir}${path.delimiter}${prevPath ?? ""}`;
	process.env.SPINE_REVIEW_TIMEOUT_MS = "200";
	delete process.env.SPINE_WORKER_RUNNER;

	try {
		const result = await runStepReview({
			taskFolder,
			worktreePath: projectRoot,
			stepNumber: 3,
			reviewType: "final",
			journal: { projectRoot, batchId, taskId, laneNumber: 4 },
			config: { lanes: { stallTimeoutMinutes: 120 } },
		});

		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, REVIEW_SPAWN_TIMEOUT_EXIT_CODE);
		assert.equal(result.reason, REVIEW_TIMEOUT_REASON);

		const events = readJournalEvents(projectRoot, batchId);
		const failed = events.find((event) => event.type === "review.failed");
		assert.ok(failed, "expected review.failed terminal event");
		assert.equal(failed.payload?.reason, REVIEW_TIMEOUT_REASON);
		assert.equal(failed.payload?.spawnFailed, true);
		assert.ok(events.some((event) => event.type === "review.started"));
		assert.ok(!events.some((event) => event.type === "review.completed"));

		const loaded = loadSpineBatchState(projectRoot);
		const task = loaded.raw?.tasks?.find((entry) => entry.taskId === taskId);
		assert.equal(task?.status, "running");
		assert.equal(result.ok, false);
	} finally {
		process.env.PATH = prevPath;
		if (prevTimeout === undefined) delete process.env.SPINE_REVIEW_TIMEOUT_MS;
		else process.env.SPINE_REVIEW_TIMEOUT_MS = prevTimeout;
		if (prevWorkerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prevWorkerRunner;
		await rm(projectRoot, { recursive: true, force: true });
		await rm(shimDir, { recursive: true, force: true });
	}
});

test("async reviewer spawn does not block the event loop while waiting for timeout", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-nonblock-"));
	const shimDir = await mkdtemp(path.join(os.tmpdir(), "spine-pi-shim-"));
	const taskFolder = writeFinalReviewTask(projectRoot);

	const prevPath = process.env.PATH;
	const prevTimeout = process.env.SPINE_REVIEW_TIMEOUT_MS;
	const prevWorkerRunner = process.env.SPINE_WORKER_RUNNER;

	await installHangingPiShim(shimDir);
	process.env.PATH = `${shimDir}${path.delimiter}${prevPath ?? ""}`;
	process.env.SPINE_REVIEW_TIMEOUT_MS = "300";
	delete process.env.SPINE_WORKER_RUNNER;

	try {
		let tickRan = false;
		const reviewPromise = runStepReview({
			taskFolder,
			worktreePath: projectRoot,
			stepNumber: 3,
			reviewType: "final",
			stub: false,
		});
		await new Promise((resolve) => {
			setImmediate(() => {
				tickRan = true;
				resolve();
			});
		});
		assert.equal(tickRan, true, "event loop should remain responsive during review wait");
		const result = await reviewPromise;
		assert.equal(result.spawnFailed, true);
		assert.equal(result.reason, REVIEW_TIMEOUT_REASON);
	} finally {
		process.env.PATH = prevPath;
		if (prevTimeout === undefined) delete process.env.SPINE_REVIEW_TIMEOUT_MS;
		else process.env.SPINE_REVIEW_TIMEOUT_MS = prevTimeout;
		if (prevWorkerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prevWorkerRunner;
		await rm(projectRoot, { recursive: true, force: true });
		await rm(shimDir, { recursive: true, force: true });
	}
});
