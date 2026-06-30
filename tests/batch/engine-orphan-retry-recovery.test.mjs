/**
 * SP-315 — engine/worker orphan leaves task running, blocking retry (issue #20 / batch 20260620T175645).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";
import { reconcileBatch, reconcileOrphanRunningState } from "../../src/batch/reconcile.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import { validateMultiTaskResume } from "../../src/batch/resume-multi-validate.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const BATCH_ID = "20260620T175645";
const TASK_SUCCEEDED = "SP-312";
const TASK_ORPHAN = "SP-311";

/**
 * Batch 20260620T175645 shape: SP-312 succeeded, SP-311 running with dead worker/engine PIDs.
 *
 * @param {string} projectRoot
 * @param {string} lane1Path
 */
function seedIssue20OrphanFixture(projectRoot, lane1Path) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_ORPHAN, TASK_SUCCEEDED]],
		tasks: [
			{
				taskId: TASK_ORPHAN,
				laneNumber: 1,
				status: "running",
				taskFolder: `spine-tasks/${TASK_ORPHAN}-git-helpers`,
				startedAt: Date.now() - 90 * 60_000,
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
			{
				taskId: TASK_SUCCEEDED,
				laneNumber: 2,
				status: "succeeded",
				taskFolder: `spine-tasks/${TASK_SUCCEEDED}-smoke`,
				doneFileFound: true,
				endedAt: Date.now() - 30 * 60_000,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: lane1Path,
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_ORPHAN],
				lastHeartbeatAt: Date.now() - 60_000,
				workerPid: DEAD_PID,
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 2),
				branch: laneTaskBranch(BATCH_ID, 2),
				taskIds: [TASK_SUCCEEDED],
			},
		],
	});
	state.phase = "running";
	state.succeededTasks = 1;
	state.failedTasks = 0;
	recordBatchEnginePid(state, DEAD_PID);
	saveSpineBatchState(projectRoot, state);
}

test("engine_orphaned with failedTaskId suggests retry (SP-315)", () => {
	assert.equal(
		buildSuggestedCommand("engine_orphaned", { failedTaskId: TASK_ORPHAN }),
		`spine batch retry ${TASK_ORPHAN}`,
	);
});

test("reconcileOrphanRunningState transitions running task to failed with journal events", async () => {
	const projectRoot = await initGitRepo("spine-315-reconcile-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });
		seedIssue20OrphanFixture(projectRoot, lane1.worktreePath);

		const before = loadSpineBatchState(projectRoot).raw;
		const result = reconcileOrphanRunningState({ projectRoot, state: before });
		assert.equal(result.reconciled, true);
		assert.equal(result.taskId, TASK_ORPHAN);

		const after = loadSpineBatchState(projectRoot).raw;
		const orphanTask = after?.tasks?.find((task) => task.taskId === TASK_ORPHAN);
		assert.equal(orphanTask?.status, "failed");
		assert.equal(orphanTask?.exitReason, "worker_orphaned");
		assert.equal(after?.phase, "failed");
		assert.equal(after?.failedTasks, 1);
		assert.equal(after?.lanes?.[0]?.workerPid, undefined);
		assert.equal(after?.resilience?.enginePid, undefined);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "task.failed" && (event.taskId ?? event.payload?.taskId) === TASK_ORPHAN));
		assert.ok(events.some((event) => event.type === "lane.died" && (event.taskId ?? event.payload?.taskId) === TASK_ORPHAN));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTask succeeds on orphan without manual pause (issue #20 trap)", async () => {
	const projectRoot = await initGitRepo("spine-315-retry-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });
		seedIssue20OrphanFixture(projectRoot, lane1.worktreePath);

		const retry = retryTask({ projectRoot, taskId: TASK_ORPHAN });
		assert.equal(retry.ok, true, retry.output ?? retry.error);

		const after = loadSpineBatchState(projectRoot).raw;
		const task = after?.tasks?.find((entry) => entry.taskId === TASK_ORPHAN);
		assert.equal(task?.status, "pending");
		assert.equal(after?.phase, "paused");

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("diagnose then retry: suggestedCommand matches working recovery path", async () => {
	const projectRoot = await initGitRepo("spine-315-diagnose-retry-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });
		seedIssue20OrphanFixture(projectRoot, lane1.worktreePath);

		const diagnosis = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(diagnosis.diagnosis, "worker_orphaned");
		assert.equal(diagnosis.suggestedCommand, `spine batch retry ${TASK_ORPHAN}`);

		const retry = retryTask({ projectRoot, taskId: TASK_ORPHAN });
		assert.equal(retry.ok, true, retry.output ?? retry.error);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resume --force allowed after orphan reconcile when phase was running", async () => {
	const projectRoot = await initGitRepo("spine-315-resume-force-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });
		seedIssue20OrphanFixture(projectRoot, lane1.worktreePath);

		const loaded = loadSpineBatchState(projectRoot);
		reconcileOrphanRunningState({ projectRoot, state: loaded.raw });

		const result = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const after = loadSpineBatchState(projectRoot).raw;
		const orphanTask = after?.tasks?.find((task) => task.taskId === TASK_ORPHAN);
		assert.equal(orphanTask?.status, "failed");
		assert.equal(after?.phase, "failed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
