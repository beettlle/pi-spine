import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
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
