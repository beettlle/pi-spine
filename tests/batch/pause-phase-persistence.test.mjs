/**
 * SP-449 — pause journal/state alignment for attached engines (GitHub #103).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { pauseBatch } from "../../src/batch/pause.mjs";
import { retryTask, skipTask } from "../../src/batch/retry.mjs";
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
 */
function writeFailedPausedMismatchBatch(projectRoot) {
	const batchId = "20260702T213025";
	const taskId = "SP-426";
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
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId };
}

test("confirmed pause records batch.paused only after engine persists phase", async () => {
	const projectRoot = await initGitRepo("spine-pause-confirmed-journal-");
	try {
		const { batchId, taskId } = writeFailedPausedMismatchBatch(projectRoot);

		const pause = await pauseBatch({ projectRoot });
		assert.equal(pause.ok, true, pause.output ?? pause.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.paused"));
		assert.equal(events.some((event) => event.type === "batch.pause_failed"), false);

		const skip = skipTask({ projectRoot, taskId });
		assert.equal(skip.ok, true, skip.output ?? skip.error);

		const retry = retryTask({ projectRoot, taskId: "SP-999" });
		assert.equal(retry.error, "task_not_found");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("unconfirmed pause does not leave orphan batch.paused journal entry", async () => {
	const projectRoot = await initGitRepo("spine-pause-orphan-journal-");
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
		const { batchId, taskId } = writeFailedPausedMismatchBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		recordBatchEnginePid(state, child.pid ?? null);
		saveSpineBatchState(projectRoot, state);

		revertInterval = setInterval(() => {
			const loaded = loadSpineBatchState(projectRoot);
			if (loaded.raw?.phase === "paused") {
				loaded.raw.phase = "running";
				saveSpineBatchState(projectRoot, loaded.raw, { bypassWriteGuard: true });
			}
		}, 20);

		const pause = await pauseBatch({
			projectRoot,
			confirmGraceMs: 250,
			pollIntervalMs: 50,
		});
		assert.equal(pause.ok, false);
		assert.equal(pause.error, "pause_not_confirmed");

		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(events.some((event) => event.type === "batch.paused"), false);
		assert.ok(events.some((event) => event.type === "batch.pause_failed"));

		const skip = skipTask({ projectRoot, taskId });
		assert.equal(skip.ok, false);
		assert.equal(skip.error, "cannot_skip");
	} finally {
		if (revertInterval) clearInterval(revertInterval);
		child.kill("SIGKILL");
		await destroyGitRepo(projectRoot);
	}
});
