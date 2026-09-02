import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { approveIntegrateGate, gateRecordPath, loadGateRecord, openIntegrateGate } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
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

test("resumeBatch opens integrate gate before batch.completed journal event", async () => {
	const projectRoot = await initGitRepo("spine-resume-gate-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const taskId = "TP-999";
		writeSmokeTask(projectRoot, taskId);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "task"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260611T225006";
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
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		const events = readJournalEvents(projectRoot, batchId);
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

/**
 * Completed 1-lane batch fixture used by the #275 reopen regressions.
 */
async function provisionCompletedBatch(projectRoot, batchId, taskId) {
	writeSmokeTask(projectRoot, taskId);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "task"], { cwd: projectRoot, stdio: "ignore" });

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
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${taskId}-smoke`),
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: true,
				exitReason: "done",
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
	state.phase = "completed";
	state.succeededTasks = 1;
	state.totalTasks = 1;
	state.segments = state.segments.map((segment) => ({ ...segment, status: "succeeded" }));
	state.mergeResults = [{ waveIndex: 0, status: "succeeded", failedLane: null, failureReason: null }];
	state.endedAt = Date.now();
	saveSpineBatchState(projectRoot, state);
	return { state, orchBranch };
}

test("force resume on completed batch without gate re-opens integrate gate (#275)", async () => {
	const projectRoot = await initGitRepo("spine-resume-reopen-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const batchId = "20260611T230006";
		const taskId = "TP-998";
		await provisionCompletedBatch(projectRoot, batchId, taskId);

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.reopened, true);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");

		const gate = loadGateRecord(projectRoot, batchId);
		assert.equal(gate.status, "pending");

		// No worker re-run: task stays succeeded and no task.started is journaled.
		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(!events.some((event) => event.type === "task.started"));
		assert.ok(events.some((event) => event.type === "gate.reopened"));
		assert.ok(events.some((event) => event.type === "gate.opened"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("force resume on completed batch re-pins drifted gate targetRevision (#275)", async () => {
	const projectRoot = await initGitRepo("spine-resume-repin-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const batchId = "20260611T230007";
		const taskId = "TP-997";
		const { orchBranch } = await provisionCompletedBatch(projectRoot, batchId, taskId);

		// Gate opened at completion, approved, then orch tip drifts past the pin.
		openIntegrateGate({
			projectRoot,
			batchId,
			batchState: loadSpineBatchState(projectRoot).raw,
		});
		approveIntegrateGate({ projectRoot, batchId });
		const stalePin = loadGateRecord(projectRoot, batchId).targetRevision;

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "orch-drift.txt"), "drift", "utf-8");
		execFileSync("git", ["add", "orch-drift.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch drift"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.reopened, true);

		const gate = loadGateRecord(projectRoot, batchId);
		assert.equal(gate.status, "pending");
		assert.notEqual(gate.targetRevision, stalePin);
		assert.equal(
			gate.targetRevision,
			execFileSync("git", ["rev-parse", "--verify", `${orchBranch}^{commit}`], {
				cwd: projectRoot,
				encoding: "utf-8",
			}).trim(),
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("resume without force on completed batch refuses with reopen guidance (#275)", async () => {
	const projectRoot = await initGitRepo("spine-resume-reopen-noforce-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const batchId = "20260611T230008";
		const taskId = "TP-996";
		await provisionCompletedBatch(projectRoot, batchId, taskId);

		const refused = await resumeBatch({ projectRoot });
		assert.equal(refused.ok, false);
		assert.equal(refused.error, "cannot_resume");
		assert.match(refused.output, /gate reopen/);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
