import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	buildReviewerChildEnv,
	buildReviewerPiArgs,
	spawnReviewerPi,
	shouldBlockNestedReviewerSpawn,
} from "../../src/batch/review-spawn.mjs";

/**
 * @param {string[]} piArgs
 */
function modelIndex(piArgs) {
	return piArgs.indexOf("--model");
}

/**
 * @param {string[]} piArgs
 */
function thinkingIndex(piArgs) {
	return piArgs.indexOf("--thinking");
}

test("buildReviewerPiArgs includes --model when config pins reviewer", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-model-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-259");
		fs.mkdirSync(taskFolder, { recursive: true });
		const reviewPrompt = path.join(taskFolder, "review-request.md");

		const piArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt,
			systemPrompt: "",
			config: {
				agents: {
					reviewer: { model: "google/gemini-3.1-pro-preview", thinking: "off" },
				},
			},
		});

		const idx = modelIndex(piArgs);
		assert.ok(idx >= 0, `expected --model in argv: ${JSON.stringify(piArgs)}`);
		assert.equal(piArgs[idx + 1], "google/gemini-3.1-pro-preview");
		assert.equal(thinkingIndex(piArgs), -1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs omits --model when reviewer model is inherit", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-inherit-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-259-inherit");
		fs.mkdirSync(taskFolder, { recursive: true });

		const piArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
			config: {
				agents: { reviewer: { model: "inherit", thinking: "high" } },
			},
		});

		assert.equal(modelIndex(piArgs), -1);
		assert.equal(thinkingIndex(piArgs), 2);
		assert.equal(piArgs[3], "high");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spawnReviewerPi fails closed when pi unavailable via SPINE_REVIEW_TEST_NO_PI", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-no-pi-"));
	const taskFolder = path.join(root, "spine-tasks", "SP-259");
	fs.mkdirSync(taskFolder, { recursive: true });
	const prev = {
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		workerRunner: process.env.SPINE_WORKER_RUNNER,
	};
	delete process.env.SPINE_WORKER_RUNNER;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = await spawnReviewerPi({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
		});
		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, 127);
		assert.match(result.error ?? "", /pi not available/i);
	} finally {
		if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerChildEnv strips SPINE_WORKER_RUNNER from reviewer child env", () => {
	const prev = process.env.SPINE_WORKER_RUNNER;
	process.env.SPINE_WORKER_RUNNER = "/path/to/spine-worker-runner.mjs";
	try {
		const env = buildReviewerChildEnv({
			taskFolder: "/tmp/task",
			worktreePath: "/tmp/wt",
		});
		assert.equal(env.SPINE_WORKER_RUNNER, undefined);
		assert.equal(env.SPINE_TASK_FOLDER, "/tmp/task");
		assert.equal(env.SPINE_WORKTREE, "/tmp/wt");
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev;
	}
});

test("shouldBlockNestedReviewerSpawn false when only worker runner leaked on engine", () => {
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		taskFolder: process.env.SPINE_TASK_FOLDER,
	};
	process.env.SPINE_WORKER_RUNNER = "/path/to/spine-worker-runner.mjs";
	delete process.env.SPINE_TASK_FOLDER;
	try {
		assert.equal(shouldBlockNestedReviewerSpawn(), false);
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.taskFolder === undefined) delete process.env.SPINE_TASK_FOLDER;
		else process.env.SPINE_TASK_FOLDER = prev.taskFolder;
	}
});

test("spawnReviewerPi allows engine spawn when worker runner leaked without journal attach", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-engine-leak-"));
	const taskFolder = path.join(root, "spine-tasks", "SP-285-engine-leak");
	fs.mkdirSync(taskFolder, { recursive: true });
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		taskFolder: process.env.SPINE_TASK_FOLDER,
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
	};
	process.env.SPINE_WORKER_RUNNER = path.join(root, "bin", "spine-worker-runner.mjs");
	delete process.env.SPINE_TASK_FOLDER;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = await spawnReviewerPi({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
		});
		assert.equal(result.spawnFailed, true);
		assert.equal(result.reason, undefined);
		assert.match(result.error ?? "", /pi not available/i);
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.taskFolder === undefined) delete process.env.SPINE_TASK_FOLDER;
		else process.env.SPINE_TASK_FOLDER = prev.taskFolder;
		if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		await rm(root, { recursive: true, force: true });
	}
});

test("shouldBlockNestedReviewerSpawn true inside live worker child session", () => {
	const prev = {
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		taskFolder: process.env.SPINE_TASK_FOLDER,
	};
	process.env.SPINE_WORKER_RUNNER = "/path/to/spine-worker-runner.mjs";
	process.env.SPINE_TASK_FOLDER = "/tmp/spine-task";
	try {
		assert.equal(shouldBlockNestedReviewerSpawn(), true);
	} finally {
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.taskFolder === undefined) delete process.env.SPINE_TASK_FOLDER;
		else process.env.SPINE_TASK_FOLDER = prev.taskFolder;
	}
});
