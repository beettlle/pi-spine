import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { startBatch } from "../../src/batch/engine.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { readMetricsLines } from "../../src/batch/metrics.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import {
	appendWorkerAgentModelArgs,
	buildWorkerPiArgs,
} from "../../bin/spine-worker-runner.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

function modelIndex(piArgs) {
	return piArgs.indexOf("--model");
}

function thinkingIndex(piArgs) {
	return piArgs.indexOf("--thinking");
}

test("appendWorkerAgentModelArgs adds --model when configured and not inherit", () => {
	const piArgs = ["-p", "--no-session"];
	appendWorkerAgentModelArgs(piArgs, {
		agents: { worker: { model: "cursor/auto", thinking: "off" } },
	});
	assert.equal(modelIndex(piArgs), 2);
	assert.equal(piArgs[3], "cursor/auto");
	assert.equal(thinkingIndex(piArgs), -1);
});

test("appendWorkerAgentModelArgs omits --model for inherit and empty", () => {
	for (const model of ["inherit", ""]) {
		const piArgs = ["-p", "--no-session"];
		appendWorkerAgentModelArgs(piArgs, {
			agents: { worker: { model, thinking: "off" } },
		});
		assert.equal(modelIndex(piArgs), -1, model);
	}
});

test("appendWorkerAgentModelArgs adds --thinking when set and not off", () => {
	const piArgs = ["-p", "--no-session"];
	appendWorkerAgentModelArgs(piArgs, {
		agents: { worker: { model: "inherit", thinking: "high" } },
	});
	assert.equal(thinkingIndex(piArgs), 2);
	assert.equal(piArgs[3], "high");
});

test("buildWorkerPiArgs includes --model cursor/auto from spine-config", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-model-pin-"));
	try {
		const worktreePath = root;
		const taskFolder = path.join(root, "spine-tasks", "SP-232-model-pin");
		const donePath = path.join(taskFolder, ".DONE");
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			`${minimalValidPromptMarkdown("SP-232", { fileScope: "src/smoke.txt" })}\n\n## Review Level: 0\n`,
			"utf-8",
		);

		const piArgs = await buildWorkerPiArgs({
			worktreePath,
			taskFolder,
			donePath,
			spineConfig: {
				agents: { worker: { model: "cursor/auto", thinking: "medium" } },
			},
		});

		const idx = modelIndex(piArgs);
		assert.ok(idx >= 0, `expected --model in argv: ${JSON.stringify(piArgs)}`);
		assert.equal(piArgs[idx + 1], "cursor/auto");
		assert.equal(piArgs[thinkingIndex(piArgs) + 1], "medium");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerPiArgs omits --model when agents.worker.model is inherit", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-model-inherit-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-232-inherit");
		const donePath = path.join(taskFolder, ".DONE");
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			`${minimalValidPromptMarkdown("SP-232", { fileScope: "src/smoke.txt" })}\n\n## Review Level: 0\n`,
			"utf-8",
		);

		const piArgs = await buildWorkerPiArgs({
			worktreePath: root,
			taskFolder,
			donePath,
			spineConfig: {
				agents: { worker: { model: "inherit", thinking: "off" } },
			},
		});

		assert.equal(modelIndex(piArgs), -1);
		assert.equal(thinkingIndex(piArgs), -1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

// ---- SP-835 (#340): SPINE_WORKER_THINKING_OVERRIDE in the child ----

test("appendWorkerAgentModelArgs: a valid SPINE_WORKER_THINKING_OVERRIDE wins over agents.worker.thinking", () => {
	const config = { agents: { worker: { model: "cursor/auto", thinking: "low" } } };
	for (const level of ["minimal", "low", "medium", "high", "xhigh"]) {
		const piArgs = ["-p"];
		appendWorkerAgentModelArgs(piArgs, config, { SPINE_WORKER_THINKING_OVERRIDE: level });
		assert.equal(piArgs[thinkingIndex(piArgs) + 1], level, level);
	}
});

test("appendWorkerAgentModelArgs: override 'off' drops --thinking even when the config sets one", () => {
	const piArgs = ["-p"];
	appendWorkerAgentModelArgs(
		piArgs,
		{ agents: { worker: { model: "inherit", thinking: "high" } } },
		{ SPINE_WORKER_THINKING_OVERRIDE: "off" },
	);
	assert.equal(thinkingIndex(piArgs), -1);
});

test("appendWorkerAgentModelArgs: an invalid override warns on stderr and keeps the config value", (t) => {
	const warn = t.mock.method(console, "error", () => {});
	const piArgs = ["-p"];
	appendWorkerAgentModelArgs(
		piArgs,
		{ agents: { worker: { model: "inherit", thinking: "medium" } } },
		{ SPINE_WORKER_THINKING_OVERRIDE: "ultra" },
	);
	assert.equal(piArgs[thinkingIndex(piArgs) + 1], "medium");
	assert.equal(warn.mock.callCount(), 1);
	assert.match(String(warn.mock.calls[0].arguments[0]), /SPINE_WORKER_THINKING_OVERRIDE="ultra" ignored/);
});

test("appendWorkerAgentModelArgs: blank or absent override is a no-op and env is injectable", () => {
	const config = { agents: { worker: { model: "inherit", thinking: "high" } } };
	for (const env of [{}, { SPINE_WORKER_THINKING_OVERRIDE: "  " }]) {
		const piArgs = ["-p"];
		appendWorkerAgentModelArgs(piArgs, config, env);
		assert.equal(piArgs[thinkingIndex(piArgs) + 1], "high");
	}
});

// ---- SP-835 (#340): stub engine run with a per-task **Profile:** ----

test("stub batch: task with **Profile:** spawns the worker with SPINE_AGENT_PROFILE_OVERRIDE and journals the effective model", async () => {
	const taskId = "TQ-835";
	const projectRoot = await initGitRepo("spine-task-profile-");
	const savedEnv = {};
	const stubEnv = {
		SPINE_WORKER_STUB: "1",
		// The stub worker fails unless its child env pins this profile.
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_PASS_PROFILE: "gemini4",
	};
	for (const key of Object.keys(stubEnv)) savedEnv[key] = process.env[key];
	Object.assign(process.env, stubEnv);
	try {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.lanes = { ...config.lanes, maxParallel: 1, queueExcess: true };
		config.agents = {
			...config.agents,
			activeProfile: "hard",
			profiles: {
				hard: { worker: { model: "zai/glm-5.3", thinking: "high" } },
				gemini4: { worker: { model: "google/gemini-4-pro", thinking: "medium" } },
			},
		};
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-profile`);
		fs.mkdirSync(folder, { recursive: true });
		const base = minimalValidPromptMarkdown(taskId, { fileScope: `src/${taskId}.txt` });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			base.replace("\n", "\n\n**Profile:** gemini4\n**Thinking:** xhigh\n"),
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add profile task"], { cwd: projectRoot, stdio: "ignore" });

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		const started = events.filter((event) => event.type === "task.started" && event.taskId === taskId);
		assert.equal(started.length, 1);
		assert.equal(started[0].payload.workerProfile, "gemini4");
		assert.equal(started[0].payload.workerModel, "google/gemini-4-pro");
		assert.equal(started[0].payload.workerThinking, "xhigh");
		assert.equal(started[0].payload.workerProfileSource, "prompt");

		const records = readMetricsLines(path.join(projectRoot, ".spine", "run-metrics.jsonl")).filter(
			(line) => line.recordType === "task" && line.taskId === taskId,
		);
		assert.equal(records.length, 1);
		assert.equal(records[0].profile, "gemini4");
		assert.equal(records[0].model, "google/gemini-4-pro");
		assert.equal(records[0].thinking, "xhigh");
	} finally {
		for (const [key, value] of Object.entries(savedEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await destroyGitRepo(projectRoot);
	}
});
