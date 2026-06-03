import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import {
	assessWaveMergeEligibility,
	isExplicitBatchScope,
	resolveBatchStartScope,
	startBatch,
} from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} fileScopePath
 */
function writeSmokeTask(projectRoot, taskId = "TP-999", fileScopePath = "src/smoke.txt") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Smoke

## Mission
Smoke task for engine tests.

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

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} tasks
 */
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

test("startBatch lane branch has commit before merge when stub touches files", async () => {
	const projectRoot = await initGitRepo("spine-engine-commit-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevTouch = process.env.SPINE_WORKER_STUB_TOUCH;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_TOUCH = "1";
	try {
		writeSmokeTask(projectRoot, "TP-999");
		writeDependencies(projectRoot, { "TP-999": [] });
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
		writeDependencies(projectRoot, { "TP-999": [] });
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

test("isExplicitBatchScope treats pending as explicit", () => {
	assert.equal(isExplicitBatchScope("pending"), true);
	assert.equal(isExplicitBatchScope("all"), false);
	assert.equal(isExplicitBatchScope("TP-001"), true);
});

test("startBatch all dry-run allows multi-wave pending backlog", async () => {
	const projectRoot = await initGitRepo("spine-engine-all-pending-");
	try {
		writeSmokeTask(projectRoot, "TP-999", "src/shared.txt");
		writeSmokeTask(projectRoot, "TP-998", "src/shared.txt");
		writeDependencies(projectRoot, { "TP-999": [], "TP-998": ["TP-999"] });
		execCommit(projectRoot, "tasks");

		const result = await startBatch({ projectRoot, scope: "all", dryRun: true, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.deepEqual(result.taskIds, ["TP-999", "TP-998"]);
		assert.equal(result.plan.waves.length, 2);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch pending dry-run excludes done tasks", async () => {
	const projectRoot = await initGitRepo("spine-engine-pending-");
	try {
		writeSmokeTask(projectRoot, "TP-999", "src/a.txt");
		writeSmokeTask(projectRoot, "TP-998", "src/b.txt");
		writeDependencies(projectRoot, { "TP-999": [], "TP-998": ["TP-999"] });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "TP-999-smoke", ".DONE"),
			"",
			"utf-8",
		);
		execCommit(projectRoot, "tasks");

		const result = await startBatch({
			projectRoot,
			scope: "pending",
			dryRun: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.deepEqual(result.taskIds, ["TP-998"]);
		assert.equal(result.plan.waves.length, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch all fails when every task has .DONE", async () => {
	const projectRoot = await initGitRepo("spine-engine-all-done-");
	try {
		writeSmokeTask(projectRoot, "TP-999");
		writeDependencies(projectRoot, { "TP-999": [] });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "TP-999-smoke", ".DONE"),
			"",
			"utf-8",
		);
		execCommit(projectRoot, "tasks");

		const result = await startBatch({ projectRoot, scope: "all", skipPreflight: true });
		assert.equal(result.ok, false);
		assert.equal(result.error, "no_pending_tasks");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch skips worker when .DONE exists on disk", async () => {
	const projectRoot = await initGitRepo("spine-engine-skip-done-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-999");
		writeDependencies(projectRoot, { "TP-999": [] });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "TP-999-smoke", ".DONE"),
			"",
			"utf-8",
		);
		execCommit(projectRoot, "tasks with done marker");

		const result = await startBatch({
			projectRoot,
			scope: "TP-999",
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, result.batchId);
		assert.ok(events.some((event) => event.type === "task.skipped_done_on_disk"));
		assert.equal(events.some((event) => event.type === "task.started"), false);

		const state = loadSpineBatchState(projectRoot);
		assert.equal(state.raw?.phase, "completed");
		assert.equal(state.raw?.succeededTasks, 1);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("resolveBatchStartScope normalizes all to pending IDs", async () => {
	const projectRoot = await initGitRepo("spine-engine-resolve-");
	try {
		writeSmokeTask(projectRoot, "TP-999");
		writeSmokeTask(projectRoot, "TP-998");
		writeDependencies(projectRoot, { "TP-999": [], "TP-998": [] });
		execCommit(projectRoot, "tasks");
		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const resolved = resolveBatchStartScope("all", tasksRoot);
		assert.equal(resolved.ok, true);
		assert.equal(resolved.policyScope, "pending");
		assert.match(resolved.scope, /TP-999/);
		assert.match(resolved.scope, /TP-998/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch explicit IDs still allow multi-wave when scope is not bare all", async () => {
	const projectRoot = await initGitRepo("spine-engine-multi-");
	try {
		writeSmokeTask(projectRoot, "TP-999", "src/shared.txt");
		writeSmokeTask(projectRoot, "TP-998", "src/shared.txt");
		writeDependencies(projectRoot, { "TP-999": [], "TP-998": ["TP-999"] });
		execCommit(projectRoot, "tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-999 TP-998",
			dryRun: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.deepEqual(result.taskIds, ["TP-999", "TP-998"]);
		assert.equal(result.plan.waves.length, 2);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch completes two-lane wave with stub workers", async () => {
	const projectRoot = await initGitRepo("spine-engine-2lane-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		setMaxParallel(projectRoot, 2);
		writeSmokeTask(projectRoot, "TP-997", "src/lane-a.txt");
		writeSmokeTask(projectRoot, "TP-998", "src/lane-b.txt");
		writeDependencies(projectRoot, { "TP-997": [], "TP-998": [] });
		execCommit(projectRoot, "add two-lane tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-997 TP-998",
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(result.taskIds?.includes("TP-997"));
		assert.ok(result.taskIds?.includes("TP-998"));

		const state = loadSpineBatchState(projectRoot);
		assert.equal(state.raw?.phase, "completed");
		assert.equal(state.raw?.succeededTasks, 2);
		assert.equal(state.raw?.lanes?.length, 2);
		assert.ok(state.raw?.mergeResults?.length >= 1);

		const events = readJournalEvents(projectRoot, result.batchId);
		const provisioned = events.filter((event) => event.type === "lane.provisioned");
		assert.equal(provisioned.length, 2);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch blocks merge on mixed outcomes", async () => {
	const projectRoot = await initGitRepo("spine-engine-mixed-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevFail = process.env.SPINE_WORKER_STUB_FAIL_TASKS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_FAIL_TASKS = "TP-998";
	try {
		setMaxParallel(projectRoot, 2);
		writeSmokeTask(projectRoot, "TP-997", "src/lane-a.txt");
		writeSmokeTask(projectRoot, "TP-998", "src/lane-b.txt");
		writeDependencies(projectRoot, { "TP-997": [], "TP-998": [] });
		execCommit(projectRoot, "add mixed-outcome tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-997 TP-998",
			skipPreflight: true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "mixed_outcome_merge_blocked");
		assert.deepEqual(result.failedTaskIds, ["TP-998"]);

		const state = loadSpineBatchState(projectRoot);
		assert.equal(state.raw?.phase, "failed");
		assert.equal(state.raw?.succeededTasks, 1);
		assert.equal(state.raw?.failedTasks, 1);
		assert.equal(state.raw?.mergeResults?.length ?? 0, 0);
		assert.match(state.raw?.lastError ?? "", /§17\.4/);

		const events = readJournalEvents(projectRoot, result.batchId);
		assert.ok(events.some((event) => event.type === "batch.merge_blocked"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevFail === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_TASKS;
		else process.env.SPINE_WORKER_STUB_FAIL_TASKS = prevFail;
		await destroyGitRepo(projectRoot);
	}
});

test("assessWaveMergeEligibility blocks failed and pending tasks", () => {
	const state = {
		wavePlan: [["TP-997", "TP-998"]],
		tasks: [
			{ taskId: "TP-997", status: "succeeded" },
			{ taskId: "TP-998", status: "failed" },
		],
		resilience: { forceMergedWaves: [] },
	};

	const blocked = assessWaveMergeEligibility(state, 0);
	assert.equal(blocked.ok, false);
	assert.deepEqual(blocked.failedTaskIds, ["TP-998"]);
	assert.match(blocked.message ?? "", /\/spine-retry-task TP-998/);
});

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}
