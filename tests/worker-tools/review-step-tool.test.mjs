import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	buildReviewStepCliArgs,
	executeSpineReviewStep,
	spineReviewStepTool,
} from "../../extensions/spine/worker-tools.ts";

/**
 * @param {string} root
 * @param {number} reviewLevel
 */
function writeReviewTask(root, reviewLevel = 2) {
	const folder = path.join(root, "spine-tasks", "TP-037-review-tool");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-037 — Review tool test

## Review Level: ${reviewLevel} (Plan and Code)

## Mission
Review tool test task.

## Dependencies
- **None**

## File Scope
- \`src/review-tool-test.txt\`

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

test("buildReviewStepCliArgs maps params and adds --stub when SPINE_WORKER_STUB=1", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const argv = buildReviewStepCliArgs({
			step: 2,
			type: "code",
			baseline: "abc123",
		});
		assert.deepEqual(argv, ["--step", "2", "--type", "code", "--baseline", "abc123", "--stub"]);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("executeSpineReviewStep fails closed without SPINE_TASK_FOLDER", () => {
	const prev = process.env.SPINE_TASK_FOLDER;
	delete process.env.SPINE_TASK_FOLDER;
	try {
		const result = executeSpineReviewStep({ step: 1, type: "plan" });
		assert.equal(result.isError, true);
		assert.match(result.content[0].text, /SPINE_TASK_FOLDER/i);
		assert.equal(result.details.exitCode, 1);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FOLDER;
		else process.env.SPINE_TASK_FOLDER = prev;
	}
});

test("spine_review_step handler returns APPROVE via stub review", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-tool-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		taskFolder: process.env.SPINE_TASK_FOLDER,
		worktree: process.env.SPINE_WORKTREE,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const result = await spineReviewStepTool.execute("tc-1", { step: 1, type: "plan" });
		assert.equal(result.isError, false);
		assert.equal(result.details.verdict, "APPROVE");
		assert.equal(result.details.exitCode, 0);
		const parsed = JSON.parse(result.content[0].text);
		assert.equal(parsed.verdict, "APPROVE");
	} finally {
		for (const [key, envKey] of [
			["taskFolder", "SPINE_TASK_FOLDER"],
			["worktree", "SPINE_WORKTREE"],
			["stub", "SPINE_REVIEW_STUB"],
		]) {
			const value = prev[key];
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
});


test("spine_review_step handler marks stub spawn failure as tool error", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-tool-fail-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		taskFolder: process.env.SPINE_TASK_FOLDER,
		worktree: process.env.SPINE_WORKTREE,
		stubFail: process.env.SPINE_REVIEW_STUB_FAIL,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_REVIEW_STUB_FAIL = "1";
	try {
		const result = await spineReviewStepTool.execute("tc-2", { step: 1, type: "plan" });
		assert.equal(result.isError, true);
		assert.equal(result.details.spawnFailed, true);
		assert.equal(result.details.exitCode, 1);
	} finally {
		if (prev.stubFail === undefined) delete process.env.SPINE_REVIEW_STUB_FAIL;
		else process.env.SPINE_REVIEW_STUB_FAIL = prev.stubFail;
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		for (const [key, envKey] of [
			["taskFolder", "SPINE_TASK_FOLDER"],
			["worktree", "SPINE_WORKTREE"],
		]) {
			const value = prev[key];
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
});

test("spine_review_step skips nested reviewer spawn inside worker session", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-tool-nested-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		taskFolder: process.env.SPINE_TASK_FOLDER,
		worktree: process.env.SPINE_WORKTREE,
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		stub: process.env.SPINE_REVIEW_STUB,
		workerStub: process.env.SPINE_WORKER_STUB,
	};
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	process.env.SPINE_WORKER_RUNNER = path.join(root, "bin", "spine-worker-runner.mjs");
	delete process.env.SPINE_REVIEW_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const result = await spineReviewStepTool.execute("tc-3", { step: 1, type: "code" });
		assert.equal(result.isError, false);
		assert.equal(result.details.skipped, true);
		assert.equal(result.details.spawnFailed, false);
		assert.equal(result.details.exitCode, 0);
		assert.match(result.content[0].text, /Nested reviewer spawn blocked/i);
		assert.match(result.content[0].text, /SP-195/i);
	} finally {
		for (const [key, envKey] of [
			["taskFolder", "SPINE_TASK_FOLDER"],
			["worktree", "SPINE_WORKTREE"],
			["workerRunner", "SPINE_WORKER_RUNNER"],
			["stub", "SPINE_REVIEW_STUB"],
			["workerStub", "SPINE_WORKER_STUB"],
		]) {
			const value = prev[key];
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
});
