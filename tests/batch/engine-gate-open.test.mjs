import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startBatch } from "../../src/batch/engine.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSmokeTask(projectRoot, taskId = "TP-999") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
	return folder;
}

test("startBatch opens integrate gate before batch.completed journal event", async () => {
	const projectRoot = await initGitRepo("spine-start-gate-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const taskId = "TP-999";
		writeSmokeTask(projectRoot, taskId);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "task"], { cwd: projectRoot, stdio: "ignore" });

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(result.batchId);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, result.batchId)));

		const events = readJournalEvents(projectRoot, result.batchId);
		const gateOpenedIndex = events.findIndex((event) => event.type === "gate.opened");
		const batchCompletedIndex = events.findIndex((event) => event.type === "batch.completed");
		assert.ok(gateOpenedIndex >= 0, "expected gate.opened journal event");
		assert.ok(batchCompletedIndex >= 0, "expected batch.completed journal event");
		assert.ok(
			gateOpenedIndex < batchCompletedIndex,
			"gate.opened must be journaled before batch.completed",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
