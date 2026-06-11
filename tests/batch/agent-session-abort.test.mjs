import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { journalPath } from "../../src/batch/journal.mjs";
import { startAgentSessionWorker } from "../../src/batch/agent-session-worker.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("agent session abort failure journals lane.worker_abort_failed", async () => {
	const projectRoot = await initGitRepo("spine-agent-abort-");
	const batchId = "20260611T130000";
	process.env.SPINE_PROJECT_ROOT = projectRoot;
	process.env.SPINE_BATCH_ID = batchId;
	process.env.SPINE_TASK_ID = "SP-1";
	process.env.SPINE_LANE_NUMBER = "1";
	process.env.SPINE_AGENT_SESSION_STUB = "1";

	const taskFolder = path.join(projectRoot, "spine-tasks", "SP-1");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), "# Task\n", "utf-8");

	let sessionReady;
	const sessionReadyPromise = new Promise((resolve) => {
		sessionReady = resolve;
	});

	const child = startAgentSessionWorker(
		{ worktreePath: projectRoot, taskFolder, projectRoot },
		{
			createAgentSession: async () => {
				const session = {
					abort: async () => {
						throw new Error("abort failed");
					},
					dispose: () => {},
					prompt: async () => {
						await new Promise((resolve) => setTimeout(resolve, 500));
					},
				};
				sessionReady();
				return { session };
			},
		},
	);

	await sessionReadyPromise;
	await new Promise((resolve) => setTimeout(resolve, 50));
	child.kill("SIGTERM");
	await new Promise((resolve) => setTimeout(resolve, 25));
	await child.wait();

	const journalFile = journalPath(projectRoot, batchId);
	assert.ok(fs.existsSync(journalFile));
	const lines = fs.readFileSync(journalFile, "utf-8").trim().split("\n");
	const events = lines.map((line) => JSON.parse(line));
	assert.ok(events.some((event) => event.type === "lane.worker_abort_failed"));

	delete process.env.SPINE_PROJECT_ROOT;
	delete process.env.SPINE_BATCH_ID;
	delete process.env.SPINE_TASK_ID;
	delete process.env.SPINE_LANE_NUMBER;
	delete process.env.SPINE_AGENT_SESSION_STUB;
	await destroyGitRepo(projectRoot);
});
