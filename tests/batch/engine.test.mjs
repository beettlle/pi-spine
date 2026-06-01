import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSmokeTask(projectRoot, taskId = "TP-999") {
	const folder = path.join(projectRoot, "taskplane-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Smoke

## Mission
Smoke task for engine tests.

## Dependencies
- **None**

## File Scope
- \`src/smoke.txt\`

## Steps
### Step 0: Done
- [ ] one
`,
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
}

test("startBatch lane branch has commit before merge when stub touches files", async () => {
	const projectRoot = await initGitRepo("spine-engine-commit-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevTouch = process.env.SPINE_WORKER_STUB_TOUCH;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_TOUCH = "1";
	try {
		writeSmokeTask(projectRoot, "TP-999");
		execCommit(projectRoot, "add smoke task");

		const result = await startBatch({
			projectRoot,
			scope: "TP-999",
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const mainHead = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		const orchHead = execFileSync("git", ["rev-parse", result.orchBranch], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.notEqual(mainHead, orchHead);
		execFileSync("git", ["merge-base", "--is-ancestor", "main", result.orchBranch], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const events = readJournalEvents(projectRoot, result.batchId);
		assert.ok(events.some((event) => event.type === "lane.committed"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevTouch === undefined) delete process.env.SPINE_WORKER_STUB_TOUCH;
		else process.env.SPINE_WORKER_STUB_TOUCH = prevTouch;
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch completes single task with stub worker", async () => {
	const projectRoot = await initGitRepo("spine-engine-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-999");
		execCommit(projectRoot, "add smoke task");

		const result = await startBatch({
			projectRoot,
			scope: "TP-999",
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(result.batchId);
		assert.equal(result.taskId, "TP-999");

		const state = loadSpineBatchState(projectRoot);
		assert.equal(state.raw?.phase, "completed");
		assert.equal(state.raw?.succeededTasks, 1);
		assert.ok(Array.isArray(state.raw?.segments));
		assert.equal(state.raw?.segments[0]?.status, "succeeded");

		const events = readJournalEvents(projectRoot, result.batchId);
		const types = events.map((e) => e.type);
		assert.ok(types.includes("batch.started"));
		assert.ok(types.includes("task.completed"));
		assert.ok(types.includes("batch.completed"));
		assert.ok(types.includes("lane.provisioned"));
		assert.equal(events[0].schemaVersion, 1);
		assert.ok(events[0].eventId);
		const provisioned = events.find((e) => e.type === "lane.provisioned");
		assert.ok(provisioned?.correlationId);
		const heartbeats = events.filter((e) => e.type === "lane.heartbeat");
		if (heartbeats.length > 0) {
			assert.equal(heartbeats[0].correlationId, provisioned?.correlationId);
		}
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch rejects multi-task scope", async () => {
	const projectRoot = await initGitRepo("spine-engine-multi-");
	try {
		writeSmokeTask(projectRoot, "TP-999");
		writeSmokeTask(projectRoot, "TP-998");
		fs.writeFileSync(
			path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "TP-999": [], "TP-998": [] } }, null, 2),
		);
		execCommit(projectRoot, "tasks");

		const result = await startBatch({ projectRoot, scope: "all", skipPreflight: true });
		assert.equal(result.ok, false);
		assert.equal(result.error, "single_task_required");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}
