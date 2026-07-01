/**
 * SP-376 — pause fail-loud when attached engine ignores pause; retry allowed when paused (GitHub #57).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { pauseBatch, waitForPauseConfirmation } from "../../src/batch/pause.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function writeRunningBatch(projectRoot, { batchId = "20260630T034859", taskId = "SP-358", enginePid = null } = {}) {
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
				taskFolder: `spine-tasks/${taskId}-smoke`,
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
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	if (enginePid != null) {
		recordBatchEnginePid(state, enginePid);
	}
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId, state };
}

function writeFailedPausedBatch(projectRoot, { batchId = "20260630T034859", taskId = "SP-358" } = {}) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: `spine-tasks/${taskId}-smoke`,
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "review_exhausted",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "paused";
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId };
}

test("pauseBatch succeeds immediately when no attached engine is alive", async () => {
	const projectRoot = await initGitRepo("spine-pause-no-engine-");
	try {
		const { batchId } = writeRunningBatch(projectRoot);

		const result = await pauseBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.paused"));
		assert.equal(events.some((event) => event.type === "batch.pause_failed"), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("pauseBatch fails loud when attached engine keeps phase running", async () => {
	const projectRoot = await initGitRepo("spine-pause-fail-loud-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	await new Promise((resolve, reject) => {
		child.once("spawn", resolve);
		child.once("error", reject);
	});

	/** @type {ReturnType<typeof setInterval> | undefined} */
	let revertInterval;
	try {
		const { batchId } = writeRunningBatch(projectRoot, { enginePid: child.pid ?? null });
		revertInterval = setInterval(() => {
			const loaded = loadSpineBatchState(projectRoot);
			if (loaded.raw?.phase === "paused") {
				loaded.raw.phase = "running";
				saveSpineBatchState(projectRoot, loaded.raw);
			}
		}, 20);

		const result = await pauseBatch({
			projectRoot,
			confirmGraceMs: 250,
			pollIntervalMs: 50,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "pause_not_confirmed");
		assert.match(result.output ?? "", /phase is still "running"/i);
		assert.match(result.output ?? "", /spine batch retry is blocked while phase is running/i);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.paused"));
		assert.ok(events.some((event) => event.type === "batch.pause_failed"));
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "running");
	} finally {
		if (revertInterval) clearInterval(revertInterval);
		child.kill("SIGKILL");
		await destroyGitRepo(projectRoot);
	}
});

test("waitForPauseConfirmation returns true when phase stays paused", async () => {
	const projectRoot = await initGitRepo("spine-pause-confirm-");
	try {
		writeRunningBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const confirmed = await waitForPauseConfirmation({
			projectRoot,
			confirmGraceMs: 100,
			pollIntervalMs: 25,
			sleepFn: async () => {},
		});
		assert.equal(confirmed, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask succeeds when batch phase is paused", async () => {
	const projectRoot = await initGitRepo("spine-retry-paused-");
	try {
		const { batchId, taskId } = writeFailedPausedBatch(projectRoot);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");
		assert.equal(loadSpineBatchState(projectRoot).raw?.tasks[0].status, "pending");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask rejects when batch phase is running", async () => {
	const projectRoot = await initGitRepo("spine-retry-running-guard-");
	try {
		const { taskId } = writeFailedPausedBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, false);
		assert.equal(result.error, "cannot_retry");
		assert.match(result.output ?? "", /Cannot retry task while batch phase is running/i);
		assert.match(result.output ?? "", /Pause the batch first/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
