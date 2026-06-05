import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runTaskOnLane } from "../../src/batch/engine-lanes.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSmokeTask(projectRoot, taskId = "TP-104") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, { fileScope: "src/smoke.txt" }),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
	return folder;
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function eventIndex(events, type, taskId) {
	return events.findIndex((event) => event.type === type && event.taskId === taskId);
}

test("startBatch records lane commit before task.completed", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-order-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevTouch = process.env.SPINE_WORKER_STUB_TOUCH;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_TOUCH = "1";
	try {
		const taskId = "TP-104";
		writeSmokeTask(projectRoot, taskId);
		execCommit(projectRoot, "lane commit order fixture");

		const result = await startBatch({
			projectRoot,
			scope: taskId,
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		const laneCompletedIdx = eventIndex(events, "lane.completed", taskId);
		const laneCommittedIdx = eventIndex(events, "lane.committed", taskId);
		const taskCompletedIdx = eventIndex(events, "task.completed", taskId);

		assert.ok(laneCompletedIdx >= 0, "expected lane.completed");
		assert.ok(laneCommittedIdx >= 0, "expected lane.committed for dirty stub touch");
		assert.ok(taskCompletedIdx >= 0, "expected task.completed");
		assert.ok(laneCommittedIdx > laneCompletedIdx, "lane.committed must follow lane.completed");
		assert.ok(taskCompletedIdx > laneCommittedIdx, "task.completed must follow lane.committed");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevTouch === undefined) delete process.env.SPINE_WORKER_STUB_TOUCH;
		else process.env.SPINE_WORKER_STUB_TOUCH = prevTouch;
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane emits task.failed not task.completed when lane commit fails", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-fail-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevStripDone = process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT = "1";
	try {
		const batchId = "20260605T120000";
		const taskId = "TP-104";
		const taskFolderRel = `spine-tasks/${taskId}-commit-fail`;
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-commit-fail`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			minimalValidPromptMarkdown(taskId, { fileScope: "src/smoke.txt", title: "Commit fail" }),
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "lane commit fail fixture");

		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const taskFolderInWorktree = path.join(wt, taskFolderRel);
		fs.mkdirSync(taskFolderInWorktree, { recursive: true });
		fs.writeFileSync(path.join(wt, "dirty-without-done.txt"), "dirty\n", "utf-8");

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "pending",
					taskFolder: taskFolderRel,
					startedAt: null,
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: wt,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const lane = state.lanes[0];
		const task = state.tasks[0];
		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-104-fail",
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "lane_commit_failed");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.failed" && event.taskId === taskId));
		assert.equal(
			events.some((event) => event.type === "task.completed" && event.taskId === taskId),
			false,
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevStripDone === undefined) delete process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT;
		else process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT = prevStripDone;
		await destroyGitRepo(projectRoot);
	}
});

test("validateSpineConfig accepts worktreeSetupIgnorePaths", () => {
	const error = validateSpineConfig({
		configVersion: 1,
		project: { name: "x", description: "" },
		paths: { tasksRoot: "spine-tasks" },
		baseBranch: "main",
		testing: { build: "", test: "", testWithCoverage: "" },
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
		},
		lanes: { maxParallel: 3, queueExcess: true, workerBackend: "subprocess" },
		gates: {
			requireBeforeIntegrate: true,
			collectBuildEvidence: true,
			collectTestEvidence: true,
		},
		worktreeSetupIgnorePaths: ["pi-spine"],
		referenceDocs: [],
		standards: [],
		neverLoad: [],
	});
	assert.equal(error, null);
});
