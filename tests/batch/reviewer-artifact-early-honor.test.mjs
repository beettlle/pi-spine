/**
 * SP-295 — early artifact honor delivery (batch 20260618T000943 / issue #5).
 * Hung reviewer pi + on-disk APPROVE completes in seconds, not full stall timeout.
 */

import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	ARTIFACT_READY_HONOR_REASON,
	runStepReview,
} from "../../src/batch/review.mjs";
import { buildReviewArtifactPath } from "../../src/batch/review-shared.mjs";
import { DEFAULT_REVIEW_SPAWN_TIMEOUT_MS } from "../../src/batch/review-spawn.mjs";

/**
 * Batch 20260618T000943 stall shape: SP-279 code review at step 2.
 *
 * @param {string} root
 */
function writeCodeReviewTask(root) {
	const taskFolder = path.join(root, "spine-tasks", "SP-279-stall");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: SP-279 — Stall fixture

**Size:** S

## Review Level: 2 (Plan and Code)

## Mission
Fixture for hung code review with on-disk APPROVE (batch 20260618T000943).

## File Scope
- \`src/fixture.txt\`

## Steps
### Step 2: Code review checkpoint
- [ ] done
`,
		"utf-8",
	);
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

/**
 * @param {string} artifactPath
 */
function writeApproveArtifact(artifactPath) {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const body = [
		"## Code Review: Code review checkpoint",
		"",
		"### Verdict: APPROVE",
		"",
		"### Summary",
		"Fixture APPROVE from batch 20260618T000943 pattern.",
		"",
		"```json",
		JSON.stringify({ verdict: "APPROVE", feedback: "Fixture APPROVE." }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}

test("DEFAULT_REVIEW_SPAWN_TIMEOUT_MS remains 90 minutes (backstop unchanged)", () => {
	assert.equal(DEFAULT_REVIEW_SPAWN_TIMEOUT_MS, 90 * 60 * 1000);
});

test("runStepReview honors on-disk APPROVE while pi hangs — seconds not stall timeout", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-artifact-honor-"));
	const batchId = "20260618T000943";
	const taskId = "SP-279";
	const shimDir = await mkdtemp(path.join(os.tmpdir(), "spine-pi-shim-honor-"));
	const taskFolder = writeCodeReviewTask(projectRoot);
	const stepNumber = 2;
	const artifactPath = buildReviewArtifactPath(taskFolder, stepNumber);

	const prevPath = process.env.PATH;
	const prevTimeout = process.env.SPINE_REVIEW_TIMEOUT_MS;
	const prevPoll = process.env.SPINE_REVIEW_ARTIFACT_POLL_MS;
	const prevQuiescence = process.env.SPINE_REVIEW_ARTIFACT_QUIESCENCE_MS;
	const prevWorkerRunner = process.env.SPINE_WORKER_RUNNER;

	await installHangingPiShim(shimDir);
	process.env.PATH = `${shimDir}${path.delimiter}${prevPath ?? ""}`;
	process.env.SPINE_REVIEW_TIMEOUT_MS = String(5 * 60 * 1000);
	process.env.SPINE_REVIEW_ARTIFACT_POLL_MS = "100";
	process.env.SPINE_REVIEW_ARTIFACT_QUIESCENCE_MS = "100";
	delete process.env.SPINE_WORKER_RUNNER;

	const startedAt = Date.now();

	try {
		const reviewPromise = runStepReview({
			taskFolder,
			worktreePath: projectRoot,
			stepNumber,
			reviewType: "code",
			journal: { projectRoot, batchId, taskId, laneNumber: 1 },
			stub: false,
		});

		await new Promise((resolve) => setTimeout(resolve, 50));
		writeApproveArtifact(artifactPath);

		const result = await reviewPromise;
		const elapsedMs = Date.now() - startedAt;

		assert.equal(result.ok, true);
		assert.equal(result.verdict, "APPROVE");
		assert.equal(result.honored, true);
		assert.equal(result.honorReason, ARTIFACT_READY_HONOR_REASON);
		assert.equal(result.spawnFailed, false);
		assert.ok(elapsedMs < 10_000, `expected early honor in seconds, took ${elapsedMs}ms`);
		assert.ok(
			elapsedMs < Number(process.env.SPINE_REVIEW_TIMEOUT_MS),
			"should not wait for full review spawn timeout",
		);

		const events = readJournalEvents(projectRoot, batchId);
		const completed = events.find((event) => event.type === "review.completed");
		assert.ok(completed, "expected review.completed journal event");
		assert.equal(completed.payload?.honorReason, ARTIFACT_READY_HONOR_REASON);
		assert.equal(completed.payload?.verdict, "APPROVE");
		assert.ok(!events.some((event) => event.type === "review.failed"));
	} finally {
		process.env.PATH = prevPath;
		if (prevTimeout === undefined) delete process.env.SPINE_REVIEW_TIMEOUT_MS;
		else process.env.SPINE_REVIEW_TIMEOUT_MS = prevTimeout;
		if (prevPoll === undefined) delete process.env.SPINE_REVIEW_ARTIFACT_POLL_MS;
		else process.env.SPINE_REVIEW_ARTIFACT_POLL_MS = prevPoll;
		if (prevQuiescence === undefined) delete process.env.SPINE_REVIEW_ARTIFACT_QUIESCENCE_MS;
		else process.env.SPINE_REVIEW_ARTIFACT_QUIESCENCE_MS = prevQuiescence;
		if (prevWorkerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prevWorkerRunner;
		await rm(projectRoot, { recursive: true, force: true });
		await rm(shimDir, { recursive: true, force: true });
	}
});
