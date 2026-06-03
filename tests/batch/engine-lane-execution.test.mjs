import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSmokeTask(projectRoot, taskId, fileScopePath) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Smoke

## Mission
Smoke task for lane execution tests.

## Dependencies
- **None**

## File Scope
- \`${fileScopePath}\`

## Steps
### Step 0: Done
- [ ] one
`,
		"utf-8",
	);
}

function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

function setMaxParallel(projectRoot, maxParallel) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.lanes = { ...config.lanes, maxParallel, queueExcess: true };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function laneIdForNumber(laneNumber) {
	return `lane-${laneNumber}`;
}

function laneTaskStartOrder(events, laneNumber) {
	const laneId = laneIdForNumber(laneNumber);
	const ordered = [];
	for (const event of events) {
		if (event.laneId !== laneId) continue;
		if (event.type === "task.started") {
			ordered.push({ phase: "started", taskId: event.taskId, at: event.timestamp });
		}
		if (event.type === "task.completed" || event.type === "task.skipped_done_on_disk") {
			ordered.push({ phase: "ended", taskId: event.taskId, at: event.timestamp });
		}
	}
	return ordered;
}

test("startBatch serializes multiple tasks on one physical lane", async () => {
	const projectRoot = await initGitRepo("spine-engine-lane-serial-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-901", "src/shared/**");
		writeSmokeTask(projectRoot, "TP-902", "src/shared/utils/**");
		writeDependencies(projectRoot, { "TP-901": [], "TP-902": [] });
		setMaxParallel(projectRoot, 4);
		execCommit(projectRoot, "lane serial tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-901 TP-902",
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		const serialized = events.find((event) => event.type === "lane.tasks_serialized");
		assert.ok(serialized, "expected lane.tasks_serialized journal event");
		assert.equal(serialized.laneId, laneIdForNumber(1));
		assert.deepEqual(serialized.payload?.taskIds, ["TP-901", "TP-902"]);

		const order = laneTaskStartOrder(events, 1);
		const firstEnd = order.find((entry) => entry.taskId === "TP-901" && entry.phase === "ended");
		const secondStart = order.find((entry) => entry.taskId === "TP-902" && entry.phase === "started");
		assert.ok(firstEnd && secondStart);
		assert.ok(secondStart.at >= firstEnd.at, "second task must start after first task ends on same lane");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch runs disjoint-scope tasks on separate lanes in parallel", async () => {
	const projectRoot = await initGitRepo("spine-engine-lane-parallel-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-911", "src/lane-a/**");
		writeSmokeTask(projectRoot, "TP-912", "src/lane-b/**");
		writeDependencies(projectRoot, { "TP-911": [], "TP-912": [] });
		setMaxParallel(projectRoot, 4);
		execCommit(projectRoot, "lane parallel tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-911 TP-912",
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		assert.equal(
			events.filter((event) => event.type === "lane.tasks_serialized").length,
			0,
			"disjoint lanes should not serialize",
		);

		const lane1Start = events.find(
			(event) =>
				event.type === "task.started" && event.laneId === laneIdForNumber(1) && event.taskId === "TP-911",
		);
		const lane2Start = events.find(
			(event) =>
				event.type === "task.started" && event.laneId === laneIdForNumber(2) && event.taskId === "TP-912",
		);
		assert.ok(lane1Start && lane2Start);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
