/**
 * SP-345 — transient worker_orphaned debounce during task.started → first heartbeat (GitHub #36).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	detectOrphanRunning,
	journalTaskAwaitingFirstHeartbeat,
} from "../../src/batch/orphan-detect.mjs";
import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch, reconcileOrphanRunningState } from "../../src/batch/reconcile.mjs";
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
const TASK_ID = "SP-137";
const BATCH_ID = "20260628T051158";

/**
 * @param {string} projectRoot
 */
function seedTransientOrphanScenario(projectRoot) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 4,
				status: "running",
				taskFolder: `spine-tasks/${TASK_ID}-merge-origin-main`,
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 4,
				laneId: "lane-4",
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 4),
				branch: laneTaskBranch(BATCH_ID, 4),
				taskIds: [TASK_ID],
				lastHeartbeatAt: Date.now() - 5_000,
				workerPid: DEAD_PID,
			},
		],
	});
	state.phase = "running";
	recordBatchEnginePid(state, process.pid);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
		taskId: TASK_ID,
		laneNumber: 4,
	});
}

test("journalTaskAwaitingFirstHeartbeat: true after task.started before lane.heartbeat", () => {
	const events = [
		{ type: "task.started", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
	];
	assert.equal(journalTaskAwaitingFirstHeartbeat(events, TASK_ID, 4), true);
});

test("journalTaskAwaitingFirstHeartbeat: false after matching lane.heartbeat", () => {
	const events = [
		{ type: "task.started", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
		{ type: "lane.heartbeat", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
	];
	assert.equal(journalTaskAwaitingFirstHeartbeat(events, TASK_ID, 4), false);
});

test("detectOrphanRunning suppresses lane orphan during first-heartbeat debounce when engine alive", () => {
	const journalEvents = [
		{ type: "task.started", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
	];
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: TASK_ID, classification: "running", laneNumber: 4 }],
		lanes: [{ laneNumber: 4, workerPid: DEAD_PID }],
		raw: { resilience: { enginePid: process.pid, engineStartedAt: Date.now() } },
		journalEvents,
	});
	assert.equal(orphan, null);
	assert.equal(isProcessAlive(DEAD_PID), false);
});

test("detectOrphanRunning still reports lane orphan before heartbeat when engine is dead", () => {
	const journalEvents = [
		{ type: "task.started", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
	];
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: TASK_ID, classification: "running", laneNumber: 4 }],
		lanes: [{ laneNumber: 4, workerPid: DEAD_PID }],
		raw: { resilience: { enginePid: DEAD_PID, engineStartedAt: Date.now() } },
		journalEvents,
	});
	assert.ok(orphan);
	assert.equal(orphan.kind, "lane");
	assert.equal(orphan.taskId, TASK_ID);
});

test("detectOrphanRunning still reports lane orphan after first heartbeat", () => {
	const journalEvents = [
		{ type: "task.started", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
		{ type: "lane.heartbeat", taskId: TASK_ID, payload: { laneNumber: 4, taskId: TASK_ID } },
	];
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: TASK_ID, classification: "running", laneNumber: 4 }],
		lanes: [{ laneNumber: 4, workerPid: DEAD_PID }],
		raw: { resilience: { enginePid: DEAD_PID, engineStartedAt: Date.now() } },
		journalEvents,
	});
	assert.ok(orphan);
	assert.equal(orphan.kind, "lane");
	assert.equal(orphan.taskId, TASK_ID);
});

test("reconcileBatch: transient dead workerPid mid-start diagnoses running not worker_orphaned", async () => {
	const projectRoot = await initGitRepo("spine-transient-orphan-debounce-");
	try {
		seedTransientOrphanScenario(projectRoot);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "running");
		assert.notEqual(result.diagnosis, "worker_orphaned");
		assert.equal(result.suggestedCommand, "/spine-status --diagnose");
		assert.match(result.headline, /is running/i);
		assert.doesNotMatch(result.suggestedCommand ?? "", /batch retry/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileOrphanRunningState does not fail running task during debounce window", async () => {
	const projectRoot = await initGitRepo("spine-transient-orphan-reconcile-");
	try {
		seedTransientOrphanScenario(projectRoot);

		const { raw: state } = loadSpineBatchState(projectRoot);
		const reconcile = reconcileOrphanRunningState({ projectRoot, state });
		assert.equal(reconcile.reconciled, false);
		assert.equal(state.tasks[0].status, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("post-heartbeat dead pid still worker_orphaned with retry", async () => {
	const projectRoot = await initGitRepo("spine-transient-orphan-post-heartbeat-");
	try {
		seedTransientOrphanScenario(projectRoot);
		appendJournalEvent(projectRoot, BATCH_ID, "lane.heartbeat", {
			taskId: TASK_ID,
			laneNumber: 4,
		});

		const { raw: state } = loadSpineBatchState(projectRoot);
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.equal(result.suggestedCommand, `spine batch retry ${TASK_ID}`);
		assert.equal(
			buildSuggestedCommand("worker_orphaned", { failedTaskId: TASK_ID }),
			`spine batch retry ${TASK_ID}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
