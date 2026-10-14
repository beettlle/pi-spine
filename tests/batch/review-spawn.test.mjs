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
import { applyActiveAgentProfile } from "../../src/config/spine-config-load.mjs";

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
		assert.equal(thinkingIndex(piArgs), 3);
		assert.equal(piArgs[4], "high");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs uses per-type model override for matching reviewType", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-per-type-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-370-per-type");
		fs.mkdirSync(taskFolder, { recursive: true });
		const config = {
			agents: {
				reviewer: {
					model: "google/gemini-3.1-pro-preview",
					thinking: "medium",
					plan: { model: "google/gemini-flash-latest", thinking: "low" },
					code: { model: "google/gemini-3.1-pro-preview", thinking: "high" },
				},
			},
		};

		const planArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
			config,
			reviewType: "plan",
		});
		const planModelIdx = modelIndex(planArgs);
		assert.ok(planModelIdx >= 0);
		assert.equal(planArgs[planModelIdx + 1], "google/gemini-flash-latest");
		assert.equal(planArgs[thinkingIndex(planArgs) + 1], "low");

		const codeArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
			config,
			reviewType: "code",
		});
		const codeModelIdx = modelIndex(codeArgs);
		assert.ok(codeModelIdx >= 0);
		assert.equal(codeArgs[codeModelIdx + 1], "google/gemini-3.1-pro-preview");
		assert.equal(codeArgs[thinkingIndex(codeArgs) + 1], "high");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs falls back to top-level reviewer pin when per-type block missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-fallback-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-370-fallback");
		fs.mkdirSync(taskFolder, { recursive: true });
		const config = {
			agents: {
				reviewer: {
					model: "google/gemini-3.1-pro-preview",
					thinking: "medium",
					plan: { model: "google/gemini-flash-latest", thinking: "low" },
				},
			},
		};

		const finalArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
			config,
			reviewType: "final",
		});
		const finalModelIdx = modelIndex(finalArgs);
		assert.ok(finalModelIdx >= 0);
		assert.equal(finalArgs[finalModelIdx + 1], "google/gemini-3.1-pro-preview");
		assert.equal(finalArgs[thinkingIndex(finalArgs) + 1], "medium");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs cascades per-type inherit to top-level reviewer pin", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-inherit-cascade-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-370-inherit-cascade");
		fs.mkdirSync(taskFolder, { recursive: true });
		const config = {
			agents: {
				reviewer: {
					model: "google/gemini-3.1-pro-preview",
					thinking: "medium",
					plan: { model: "inherit", thinking: "inherit" },
				},
			},
		};

		const planArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt: path.join(taskFolder, "review-request.md"),
			systemPrompt: "",
			config,
			reviewType: "plan",
		});
		const planModelIdx = modelIndex(planArgs);
		assert.ok(planModelIdx >= 0);
		assert.equal(planArgs[planModelIdx + 1], "google/gemini-3.1-pro-preview");
		assert.equal(planArgs[thinkingIndex(planArgs) + 1], "medium");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// SP-819 / #334 — reviewers pass -ne (pi --no-extensions) by default
// ---------------------------------------------------------------------------

/**
 * Assert the full reviewer argv shape: optional leading `-ne`, then the stable
 * -p/--no-session/append-system-prompt/model/thinking/prompt spine.
 *
 * @param {string[]} piArgs
 * @param {{ withNe: boolean, model?: string, thinking?: string, systemPrompt: string, reviewPrompt: string, worktreePath: string }} expected
 */
function assertReviewerArgShape(piArgs, expected) {
	const wanted = [];
	if (expected.withNe) wanted.push("-ne");
	wanted.push("-p", "--no-session");
	wanted.push("--append-system-prompt", path.join(expected.worktreePath, ".spine", "agents", "reviewer.md"));
	wanted.push("--append-system-prompt", expected.systemPrompt);
	if (expected.model) wanted.push("--model", expected.model);
	if (expected.thinking) wanted.push("--thinking", expected.thinking);
	wanted.push(expected.reviewPrompt);
	assert.deepEqual(piArgs, wanted);
}

/**
 * Create a temp worktree with a task folder, a review prompt, and the reviewer
 * agent prompt file so both `--append-system-prompt` entries are exercised.
 */
async function makeReviewerSpawnFixture(prefix) {
	const root = await mkdtemp(path.join(os.tmpdir(), prefix));
	const taskFolder = path.join(root, "spine-tasks", "SP-819");
	fs.mkdirSync(taskFolder, { recursive: true });
	const reviewerAgentPath = path.join(root, ".spine", "agents", "reviewer.md");
	fs.mkdirSync(path.dirname(reviewerAgentPath), { recursive: true });
	fs.writeFileSync(reviewerAgentPath, "You are the spine reviewer.\n");
	const reviewPrompt = path.join(taskFolder, "review-request.md");
	return { root, taskFolder, reviewPrompt };
}

test("buildReviewerPiArgs passes -ne by default so reviewers skip user pi extensions", async () => {
	const { root, taskFolder, reviewPrompt } = await makeReviewerSpawnFixture(
		"spine-review-spawn-ne-default-",
	);
	try {
		const piArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt,
			systemPrompt: "Review contract.",
			config: { agents: { reviewer: {} } },
		});

		assert.equal(piArgs[0], "-ne");
		assert.equal(piArgs[1], "-p");
		assert.equal(piArgs[2], "--no-session");
		assertReviewerArgShape(piArgs, {
			withNe: true,
			systemPrompt: "Review contract.",
			reviewPrompt,
			worktreePath: root,
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs omits -ne when loadUserExtensions is true", async () => {
	const { root, taskFolder, reviewPrompt } = await makeReviewerSpawnFixture(
		"spine-review-spawn-ne-optout-",
	);
	try {
		const piArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt,
			systemPrompt: "Review contract.",
			config: { agents: { reviewer: { loadUserExtensions: true } } },
		});

		assert.ok(!piArgs.includes("-ne"), `expected no -ne in argv: ${JSON.stringify(piArgs)}`);
		assert.equal(piArgs[0], "-p");
		assertReviewerArgShape(piArgs, {
			withNe: false,
			systemPrompt: "Review contract.",
			reviewPrompt,
			worktreePath: root,
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs keeps -ne when loadUserExtensions is explicitly false", async () => {
	const { root, taskFolder, reviewPrompt } = await makeReviewerSpawnFixture(
		"spine-review-spawn-ne-false-",
	);
	try {
		const piArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt,
			systemPrompt: "Review contract.",
			config: { agents: { reviewer: { loadUserExtensions: false } } },
		});

		assert.equal(piArgs[0], "-ne");
		assertReviewerArgShape(piArgs, {
			withNe: true,
			systemPrompt: "Review contract.",
			reviewPrompt,
			worktreePath: root,
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs keeps model/thinking/prompt positions stable across -ne toggles", async () => {
	const { root, taskFolder, reviewPrompt } = await makeReviewerSpawnFixture(
		"spine-review-spawn-ne-stable-",
	);
	try {
		for (const loadUserExtensions of [undefined, true, false]) {
			const piArgs = buildReviewerPiArgs({
				worktreePath: root,
				taskFolder,
				reviewPrompt,
				systemPrompt: "Review contract.",
				config: {
					agents: {
						reviewer: {
							model: "google/gemini-3.1-pro-preview",
							thinking: "high",
							loadUserExtensions,
						},
					},
				},
			});

			assertReviewerArgShape(piArgs, {
				withNe: loadUserExtensions !== true,
				model: "google/gemini-3.1-pro-preview",
				thinking: "high",
				systemPrompt: "Review contract.",
				reviewPrompt,
				worktreePath: root,
			});
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerPiArgs honors profile-resolved loadUserExtensions (SP-819)", async () => {
	const { root, taskFolder, reviewPrompt } = await makeReviewerSpawnFixture(
		"spine-review-spawn-ne-profile-",
	);
	try {
		const config = applyActiveAgentProfile({
			agents: {
				reviewer: { model: "inherit", thinking: "off" },
				profiles: {
					ext: { reviewer: { loadUserExtensions: true } },
				},
				activeProfile: "ext",
			},
		});

		const piArgs = buildReviewerPiArgs({
			worktreePath: root,
			taskFolder,
			reviewPrompt,
			systemPrompt: "Review contract.",
			config,
		});

		assert.ok(!piArgs.includes("-ne"), `expected no -ne in argv: ${JSON.stringify(piArgs)}`);
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

test("spawnReviewerPi returns stdout/stderr tails and durationMs on exit 0", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-spawn-capture-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		fs.writeFileSync(
			path.join(binDir, "pi"),
			[
				"#!/bin/sh",
				'echo "PI_STDOUT_MARKER"',
				'echo "PI_STDERR_MARKER" >&2',
				"exit 0",
				"",
			].join("\n"),
			{ mode: 0o755 },
		);
		const taskFolder = path.join(root, "spine-tasks", "SP-814-capture");
		fs.mkdirSync(taskFolder, { recursive: true });
		const prev = {
			path: process.env.PATH,
			workerRunner: process.env.SPINE_WORKER_RUNNER,
			taskFolder: process.env.SPINE_TASK_FOLDER,
			noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		};
		process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
		delete process.env.SPINE_WORKER_RUNNER;
		delete process.env.SPINE_TASK_FOLDER;
		delete process.env.SPINE_REVIEW_TEST_NO_PI;
		try {
			const result = await spawnReviewerPi({
				worktreePath: root,
				taskFolder,
				reviewPrompt: "# Review Request: no artifact path",
				systemPrompt: "",
				timeoutMs: 10_000,
			});
			assert.equal(result.spawnFailed, false);
			assert.equal(result.exitCode, 0);
			assert.match(result.stdoutTail ?? "", /PI_STDOUT_MARKER/);
			assert.match(result.stderrTail ?? "", /PI_STDERR_MARKER/);
			assert.ok(
				typeof result.durationMs === "number" && result.durationMs >= 0,
				`durationMs must be a non-negative number, got ${JSON.stringify(result.durationMs)}`,
			);
		} finally {
			process.env.PATH = prev.path;
			if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
			else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
			if (prev.taskFolder === undefined) delete process.env.SPINE_TASK_FOLDER;
			else process.env.SPINE_TASK_FOLDER = prev.taskFolder;
			if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
			else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		}
	} finally {
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
