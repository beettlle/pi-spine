import assert from "node:assert/strict";
import test from "node:test";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { detectOrphanRunning } from "../../src/batch/orphan-detect.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const BATCH_ID = "20260712T234002";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function seedDeadEngineMultiLaneOrphan(projectRoot, options = {}) {
	const runningTasks = options.runningTasks ?? [
		{ taskId: "SP-641", laneNumber: 1 },
		{ taskId: "SP-642", laneNumber: 2 },
		{ taskId: "SP-643", laneNumber: 3 },
		{ taskId: "SP-644", laneNumber: 4 },
	];
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [runningTasks.map((task) => task.taskId)],
		tasks: runningTasks.map((task) => ({
			taskId: task.taskId,
			laneNumber: task.laneNumber,
			status: "running",
			taskFolder: `spine-tasks/${task.taskId}-orphan`,
			startedAt: Date.now(),
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		})),
		lanes: runningTasks.map((task) => ({
			laneNumber: task.laneNumber,
			laneId: `lane-${task.laneNumber}`,
			worktreePath: laneWorktreePath(projectRoot, BATCH_ID, task.laneNumber),
			branch: laneTaskBranch(BATCH_ID, task.laneNumber),
			taskIds: [task.taskId],
			lastHeartbeatAt: Date.now() - 120_000,
			workerPid: DEAD_PID,
		})),
	});
	state.phase = "running";
	recordBatchEnginePid(state, DEAD_PID);
	saveSpineBatchState(projectRoot, state);

	for (const task of runningTasks) {
		appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
			taskId: task.taskId,
			laneNumber: task.laneNumber,
		});
		appendJournalEvent(projectRoot, BATCH_ID, "lane.heartbeat", {
			laneNumber: task.laneNumber,
			taskId: task.taskId,
		});
	}
}

test("detectOrphanRunning: dead engine + stale multi-lane workers is engine orphan", () => {
	const runningTasks = [
		{ taskId: "SP-641", classification: "running", laneNumber: 1 },
		{ taskId: "SP-642", classification: "running", laneNumber: 2 },
		{ taskId: "SP-643", classification: "running", laneNumber: 3 },
		{ taskId: "SP-644", classification: "running", laneNumber: 4 },
	];
	const lanes = runningTasks.map((task) => ({
		laneNumber: task.laneNumber,
		workerPid: DEAD_PID,
	}));

	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: runningTasks,
		lanes,
		raw: { resilience: { enginePid: DEAD_PID, engineStartedAt: Date.now() - 60_000 } },
		journalEvents: [
			{ type: "batch.resumed", timestamp: Date.now() - 30_000 },
			{ type: "task.started", taskId: "SP-641", laneNumber: 1 },
			{ type: "lane.heartbeat", taskId: "SP-641", laneNumber: 1 },
		],
	});

	assert.ok(orphan);
	assert.equal(orphan.kind, "engine");
	assert.equal(orphan.enginePid, DEAD_PID);
	assert.equal(orphan.taskId, "SP-641");
	assert.equal(isProcessAlive(DEAD_PID), false);
});

test("detectOrphanRunning: cleared enginePid + multi-lane dead workers is engine orphan (#203)", () => {
	const runningTasks = [
		{ taskId: "SP-641", classification: "running", laneNumber: 1 },
		{ taskId: "SP-642", classification: "running", laneNumber: 2 },
	];
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: runningTasks,
		lanes: [
			{ laneNumber: 1, workerPid: DEAD_PID },
			{ laneNumber: 2, workerPid: DEAD_PID },
		],
		raw: { resilience: { enginePid: null, engineStartedAt: Date.now() - 60_000 } },
		journalEvents: [
			{ type: "task.started", taskId: "SP-641", laneNumber: 1 },
			{ type: "lane.heartbeat", taskId: "SP-641", laneNumber: 1 },
			{ type: "task.started", taskId: "SP-642", laneNumber: 2 },
			{ type: "lane.heartbeat", taskId: "SP-642", laneNumber: 2 },
		],
	});

	assert.ok(orphan);
	assert.equal(orphan.kind, "engine");
	assert.equal(orphan.enginePid, null);
	assert.equal(orphan.taskId, "SP-641");
});

test("detectOrphanRunning: dead engine + missing workerPid on a lane is engine orphan (#203)", () => {
	const runningTasks = [
		{ taskId: "SP-641", classification: "running", laneNumber: 1 },
		{ taskId: "SP-642", classification: "running", laneNumber: 2 },
	];
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: runningTasks,
		lanes: [
			{ laneNumber: 1, workerPid: DEAD_PID },
			{ laneNumber: 2 },
		],
		raw: { resilience: { enginePid: DEAD_PID, engineStartedAt: Date.now() - 60_000 } },
		journalEvents: [
			{ type: "task.started", taskId: "SP-641", laneNumber: 1 },
			{ type: "lane.heartbeat", taskId: "SP-641", laneNumber: 1 },
			{ type: "task.started", taskId: "SP-642", laneNumber: 2 },
		],
	});

	assert.ok(orphan);
	assert.equal(orphan.kind, "engine");
	assert.equal(orphan.enginePid, DEAD_PID);
	assert.equal(orphan.taskId, "SP-641");
});

test("detectOrphanRunning: single-lane dual-dead stays lane orphan", () => {
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: "SP-641", classification: "running", laneNumber: 1 }],
		lanes: [{ laneNumber: 1, workerPid: DEAD_PID }],
		raw: { resilience: { enginePid: DEAD_PID, engineStartedAt: Date.now() - 60_000 } },
		journalEvents: [
			{ type: "task.started", taskId: "SP-641", laneNumber: 1 },
			{ type: "lane.heartbeat", taskId: "SP-641", laneNumber: 1 },
		],
	});

	assert.ok(orphan);
	assert.equal(orphan.kind, "lane");
	assert.equal(orphan.taskId, "SP-641");
});

test("cleared enginePid multi-lane orphan reconciles as engine_orphaned (#203)", async () => {
	const projectRoot = await initGitRepo("spine-cleared-engine-multi-lane-");
	try {
		seedDeadEngineMultiLaneOrphan(projectRoot);
		const loaded = loadSpineBatchState(projectRoot);
		assert.ok(loaded.raw);
		loaded.raw.resilience = { ...(loaded.raw.resilience ?? {}), enginePid: null };
		saveSpineBatchState(projectRoot, loaded.raw);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.match(result.suggestedCommand ?? "", /batch retry SP-641/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dead engine multi-lane orphan reconciles as engine_orphaned with single retry command (#203)", async () => {
	const projectRoot = await initGitRepo("spine-dead-engine-multi-lane-");
	try {
		seedDeadEngineMultiLaneOrphan(projectRoot);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.notEqual(result.diagnosis, "worker_orphaned");
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, "spine batch retry SP-641");
		assert.match(result.headline, /engine died/i);
		assert.doesNotMatch(result.headline, /lane worker orphaned/i);
		assert.equal(result.batchId, BATCH_ID);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("live engine + stale worker stays worker_orphaned", async () => {
	const projectRoot = await initGitRepo("spine-live-engine-stale-worker-");
	try {
		const taskId = "SP-646";
		const state = createInitialBatchState({
			batchId: "20260713T010101",
			baseBranch: "main",
			orchBranch: "orch/spine-20260713T010101",
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
					worktreePath: laneWorktreePath(projectRoot, "20260713T010101", 1),
					branch: laneTaskBranch("20260713T010101", 1),
					taskIds: [taskId],
					lastHeartbeatAt: Date.now() - 60_000,
					workerPid: DEAD_PID,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, "20260713T010101", "task.started", {
			taskId,
			laneNumber: 1,
		});
		appendJournalEvent(projectRoot, "20260713T010101", "lane.heartbeat", {
			laneNumber: 1,
			taskId,
		});

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.equal(result.suggestedCommand, `spine batch retry ${taskId}`);
		assert.match(result.headline, /lane worker orphaned/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
