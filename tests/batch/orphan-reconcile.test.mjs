import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
	spineBatchStatePath,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import { detectOrphanRunning } from "../../src/batch/orphan-detect.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { loadScenario, materializeScenario } from "../helpers/scenario-fixture.mjs";

const DEAD_PID = 999_999_999;

test("isProcessAlive returns false for absent pid", () => {
	assert.equal(isProcessAlive(DEAD_PID), false);
	assert.equal(isProcessAlive(null), false);
	assert.equal(isProcessAlive(0), false);
});

test("resume parallel lane orphan fixture: multiple running on lane 1", () => {
	const fixture = loadScenario("resume-parallel-lane-orphan");
	const runningLane1 = fixture.batchState.tasks.filter(
		(task) => task.laneNumber === 1 && task.status === "running",
	);
	assert.equal(runningLane1.length, 5);
	assert.deepEqual(
		runningLane1.map((task) => task.taskId).sort(),
		["SAT-039", "SAT-040", "SAT-042", "SAT-043", "SAT-044"],
	);
});

test("resume parallel lane orphan fixture: reconcile is actionable after scoped orphan detect", async () => {
	const projectRoot = await initGitRepo("spine-resume-parallel-lane-orphan-");
	try {
		materializeScenario(projectRoot, "resume-parallel-lane-orphan");

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.ok(["engine_orphaned", "worker_orphaned"].includes(result.diagnosis));
		assert.equal(result.batchId, "20260603T224829");
		if (result.diagnosis === "engine_orphaned") {
			assert.match(result.suggestedCommand, /^spine batch (retry |resume --attached)/);
			assert.match(result.headline, /engine died/i);
		} else {
			assert.match(result.suggestedCommand, /^(spine batch retry |spine batch abort)/);
			assert.match(result.headline, /lane worker orphaned/i);
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("searchATon orphan incident fixture: dead workerPid is not diagnosed as running", async () => {
	const projectRoot = await initGitRepo("spine-orphan-incident-");
	try {
		materializeScenario(projectRoot, "orphan-running-resume");

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.equal(result.suggestedCommand, "spine batch retry SAT-040");
		assert.match(result.headline, /lane worker orphaned/i);
		assert.equal(result.batchId, "20260603T185308");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dead workerPid with running task is not diagnosed as running", async () => {
	const projectRoot = await initGitRepo("spine-orphan-worker-");
	try {
		const batchId = "20260603T185308";
		const taskId = "SP-082";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${taskId}-orphan`,
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
					taskIds: [taskId],
					lastHeartbeatAt: Date.now() - 60_000,
					workerPid: DEAD_PID,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });
		appendJournalEvent(projectRoot, batchId, "lane.heartbeat", { laneNumber: 1, taskId });

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.equal(result.suggestedCommand, `spine batch retry ${taskId}`);
		assert.match(result.headline, /lane worker orphaned/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dead enginePid mid-resume without terminal journal is engine_orphaned", async () => {
	const projectRoot = await initGitRepo("spine-orphan-engine-");
	try {
		const batchId = "20260603T185309";
		const taskId = "SP-083";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${taskId}-orphan`,
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
					taskIds: [taskId],
					lastHeartbeatAt: Date.now() - 30_000,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "batch.resumed", { pendingSegments: 1 });
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, `spine batch retry ${taskId}`);
		assert.match(result.headline, /engine died/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("running batch without recorded pids still reports running", async () => {
	const projectRoot = await initGitRepo("spine-orphan-live-");
	try {
		const fixture = JSON.parse(
			fs.readFileSync(
				path.join(process.cwd(), "tests/fixtures/batch-state/running-batch.json"),
				"utf-8",
			),
		);
		fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".pi", "batch-state.json"),
			JSON.stringify(fixture, null, 2),
			"utf-8",
		);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("detectOrphanRunning ignores dead engine when terminal journal exists", () => {
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: "TP-1", classification: "running", laneNumber: 1 }],
		lanes: [{ laneNumber: 1 }],
		raw: { resilience: { enginePid: DEAD_PID } },
		journalEvents: [{ type: "task.failed", taskId: "TP-1" }],
	});
	assert.equal(orphan, null);
});

test("recordBatchEnginePid persists under resilience and clears on terminal save", async () => {
	const projectRoot = await initGitRepo("spine-engine-pid-");
	try {
		const batchId = "20260603T120000";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["TP-1"]],
			tasks: [{ taskId: "TP-1", laneNumber: 1, status: "pending", taskFolder: null }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-1"], lastHeartbeatAt: null }],
		});
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		const loaded = loadSpineBatchState(projectRoot);
		assert.equal(loaded.raw?.resilience?.enginePid, DEAD_PID);
		assert.ok(loaded.raw?.resilience?.engineStartedAt);

		state.phase = "completed";
		state.endedAt = Date.now();
		saveSpineBatchState(projectRoot, state);
		const terminal = JSON.parse(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"));
		assert.equal(terminal.resilience?.enginePid, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
