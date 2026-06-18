import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	isActiveWorkerSession,
	NESTED_REVIEW_SPAWN_BLOCKED,
	NESTED_REVIEW_SPAWN_REASON,
	runStepReview,
} from "../../src/batch/review.mjs";

/**
 * @param {string} root
 * @param {number} reviewLevel
 */
function writeReviewTask(root, reviewLevel = 2) {
	const folder = path.join(root, "spine-tasks", "TP-194-nested-guard");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-194 — Nested reviewer guard

## Review Level: ${reviewLevel} (Plan and Code)

## Mission
Guard test task.

## Dependencies
- **None**

## File Scope
- \`src/nested-guard-test.txt\`

## Steps
### Step 1: Work
- [ ] one

## Completion Criteria
- [ ] done

## Do NOT
- nothing
`,
		"utf-8",
	);
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	return folder;
}

test("isActiveWorkerSession true when SPINE_WORKER_RUNNER is set", () => {
	const prev = process.env.SPINE_WORKER_RUNNER;
	process.env.SPINE_WORKER_RUNNER = "/path/to/spine-worker-runner.mjs";
	try {
		assert.equal(isActiveWorkerSession(), true);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev;
	}
});

test("isActiveWorkerSession false outside worker context", () => {
	const prev = process.env.SPINE_WORKER_RUNNER;
	delete process.env.SPINE_WORKER_RUNNER;
	try {
		assert.equal(isActiveWorkerSession(), false);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev;
	}
});

test("runStepReview skips nested reviewer spawn when worker env is set", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-nested-guard-block-"));
	const batchId = "20260611T194000";
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_WORKER_RUNNER = path.join(root, "bin", "spine-worker-runner.mjs");
	delete process.env.SPINE_REVIEW_STUB;
	delete process.env.SPINE_REVIEW_TEST_NO_PI;
	try {
		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "code",
			journal: { projectRoot: root, batchId, taskId: "TP-194", laneNumber: 1 },
		});
		assert.equal(result.ok, true);
		assert.equal(result.skipped, true);
		assert.equal(result.spawnFailed, false);
		assert.equal(result.feedback, NESTED_REVIEW_SPAWN_BLOCKED);
		assert.equal(result.exitCode, 0);

		const events = readJournalEvents(root, batchId);
		const skipped = events.find((event) => event.type === "review.skipped");
		assert.ok(skipped);
		assert.equal(skipped.payload?.reason, NESTED_REVIEW_SPAWN_REASON);
		assert.equal(events.some((event) => event.type === "review.failed"), false);
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview skips nested plan review spawn when worker env is set", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-nested-guard-plan-"));
	const batchId = "20260617T180000";
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_WORKER_RUNNER = path.join(root, "bin", "spine-worker-runner.mjs");
	delete process.env.SPINE_REVIEW_STUB;
	try {
		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			journal: { projectRoot: root, batchId, taskId: "TP-194", laneNumber: 1 },
		});
		assert.equal(result.ok, true);
		assert.equal(result.skipped, true);
		assert.equal(result.exitCode, 0);
		const events = readJournalEvents(root, batchId);
		assert.ok(events.some((event) => event.type === "review.skipped"));
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview stub path still works inside worker session", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-nested-guard-stub-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_WORKER_RUNNER = path.join(root, "bin", "spine-worker-runner.mjs");
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			stub: true,
		});
		assert.equal(result.ok, true);
		assert.equal(result.spawnFailed, false);
		assert.equal(result.verdict, "APPROVE");
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview reaches pi availability check when worker env absent", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-nested-guard-allow-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	delete process.env.SPINE_WORKER_RUNNER;
	delete process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
		});
		assert.equal(result.spawnFailed, true);
		assert.notEqual(result.error, NESTED_REVIEW_SPAWN_BLOCKED);
		assert.match(result.error ?? "", /pi not available/i);
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		await rm(root, { recursive: true, force: true });
	}
});
