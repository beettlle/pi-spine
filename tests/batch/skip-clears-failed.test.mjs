/**
 * SP-442 — skip clears failed segment so batch can merge (GitHub #96).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { skipTask } from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function writeFailedSingleLaneBatch(projectRoot, { batchId = "20260702T213025", taskId = "SP-426" } = {}) {
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
	state.phase = "failed";
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId };
}

test("skipTask leaves phase paused when all tasks terminal without merge", async () => {
	const projectRoot = await initGitRepo("spine-skip-unblock-phase-");
	try {
		const { taskId } = writeFailedSingleLaneBatch(projectRoot);

		const before = reconcileBatch({ projectRoot });
		assert.equal(before.diagnosis, "needs_retry");

		const result = skipTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.phase, "paused");
		assert.equal(saved?.failedTasks, 0);
		assert.equal(saved?.segments[0].status, "skipped");

		const after = reconcileBatch({ projectRoot });
		assert.notEqual(after.diagnosis, "needs_retry");
		assert.notEqual(after.diagnosis, "failed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTask clears failed segment drift for reconcile", async () => {
	const projectRoot = await initGitRepo("spine-skip-clear-segment-");
	try {
		const { taskId } = writeFailedSingleLaneBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const blocked = reconcileBatch({ projectRoot });
		assert.equal(blocked.diagnosis, "needs_retry");

		const result = skipTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);

		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconciliation.signals?.hasFailedTasks, false);
		assert.equal(reconciliation.signals?.hasSegmentDrift, false);
		assert.equal(reconciliation.diagnosis, "paused");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
