import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { pauseBatch, resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	defaultSegmentId,
	loadSpineBatchState,
	saveSpineBatchState,
	validateBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
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

test("pauseBatch sets phase paused and journals batch.paused", async () => {
	const projectRoot = await initGitRepo("spine-resume-pause-");
	try {
		const batchId = "20260601T160000";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["TP-999"]],
			tasks: [
				{
					taskId: "TP-999",
					laneNumber: 1,
					status: "running",
					taskFolder: "spine-tasks/TP-999-smoke",
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["TP-999"],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const result = pauseBatch({ projectRoot });
		assert.equal(result.ok, true);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.paused"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch continues paused single-lane batch", async () => {
	const projectRoot = await initGitRepo("spine-resume-run-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const taskId = "TP-999";
		writeSmokeTask(projectRoot, taskId);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "task"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260601T160001";
		const orchBranch = `orch/spine-${batchId}`;
		const taskBranch = laneTaskBranch(batchId, 1);
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: path.join("spine-tasks", `${taskId}-smoke`),
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath,
					branch: taskBranch,
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");

		const events = readJournalEvents(projectRoot, batchId);
		const resumed = events.find((event) => event.type === "batch.resumed");
		assert.ok(resumed);
		assert.ok(resumed.payload?.pendingSegments != null);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("paused spine batch reconciliation suggests spine batch resume", async () => {
	const projectRoot = await initGitRepo("spine-resume-reconcile-");
	try {
		const batchId = "20260601T160002";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["TP-999"]],
			tasks: [
				{
					taskId: "TP-999",
					laneNumber: 1,
					status: "running",
					taskFolder: "spine-tasks/TP-999-smoke",
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["TP-999"],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "paused");
		assert.equal(result.suggestedCommand, "spine batch resume");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateBatchState requires segments aligned with tasks", () => {
	const state = createInitialBatchState({
		batchId: "20260601T160003",
		baseBranch: "main",
		orchBranch: "orch/spine-20260601T160003",
		wavePlan: [["TP-999"]],
		tasks: [
			{
				taskId: "TP-999",
				laneNumber: 1,
				status: "pending",
				taskFolder: "spine-tasks/TP-999-smoke",
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
				worktreePath: ".worktrees/spine-20260601T160003/lane-1",
				branch: "task/spine-lane-1-20260601T160003",
				taskIds: ["TP-999"],
				lastHeartbeatAt: null,
			},
		],
	});

	assert.equal(state.segments[0].segmentId, defaultSegmentId("TP-999"));
	const result = validateBatchState(state);
	assert.equal(result.ok, true);
});
