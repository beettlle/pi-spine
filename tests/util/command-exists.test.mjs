import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { commandExists } from "../../src/util/command-exists.mjs";
import { commandExists as reviewCommandExists, runStepReview } from "../../src/batch/review.mjs";

test("commandExists returns false for missing commands", () => {
	assert.equal(commandExists("nonexistent-cmd-xyz-sp256"), false);
});

test("commandExists returns true for common installed commands", () => {
	assert.equal(commandExists("node"), true);
	assert.equal(commandExists("git"), true);
});

test("review commandExists honors SPINE_REVIEW_TEST_NO_PI", () => {
	const prev = process.env.SPINE_REVIEW_TEST_NO_PI;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		assert.equal(reviewCommandExists("pi"), false);
	} finally {
		if (prev === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev;
	}
});

test("runStepReview fails closed when pi unavailable via SPINE_REVIEW_TEST_NO_PI", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-command-exists-review-"));
	const taskFolder = path.join(root, "spine-tasks", "SP-256-review");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: SP-256 — commandExists regression

## Review Level: 2 (Plan and Code)

## Mission
Regression test task.

## Dependencies
- **None**

## File Scope
- \`src/util/command-exists.mjs\`

## Steps
### Step 1: Work
- [ ] one

## Completion Criteria
- [ ] done
`,
	);

	const prevStub = process.env.SPINE_REVIEW_STUB;
	const prevNoPi = process.env.SPINE_REVIEW_TEST_NO_PI;
	const prevWorkerRunner = process.env.SPINE_WORKER_RUNNER;
	delete process.env.SPINE_REVIEW_STUB;
	delete process.env.SPINE_WORKER_RUNNER;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
		});
		assert.equal(result.spawnFailed, true);
		assert.match(result.error ?? "", /pi not available/i);
	} finally {
		if (prevNoPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prevNoPi;
		if (prevStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevStub;
		if (prevWorkerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prevWorkerRunner;
		await rm(root, { recursive: true, force: true });
	}
});
