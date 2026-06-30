/**
 * SP-337 / GitHub #28 — dismiss must terminate orphaned lane worker PIDs.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { dismissBatch } from "../../src/batch/lifecycle.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260630T161426";

/**
 * @param {import("node:child_process").ChildProcess} child
 */
function waitForChildExit(child) {
	if (child.exitCode !== null || child.signalCode != null) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		child.once("exit", () => resolve());
	});
}

/**
 * @param {string} projectRoot
 * @param {number} workerPid
 */
function writeRunningBatchWithWorker(projectRoot, workerPid) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [["SP-337"]],
		tasks: [
			{
				taskId: "SP-337",
				laneNumber: 1,
				status: "running",
				taskFolder: "spine-tasks/SP-337-dismiss-orphan-worker-kill",
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
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: ["SP-337"],
				lastHeartbeatAt: Date.now(),
				workerPid,
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return state;
}

test("dismissBatch kills live stub worker PID and journals lane.worker_terminated", async () => {
	const projectRoot = await initGitRepo("spine-dismiss-kill-worker-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	try {
		assert.ok(child.pid != null && child.pid > 0);
		assert.equal(isProcessAlive(child.pid), true);

		writeRunningBatchWithWorker(projectRoot, child.pid);
		appendJournalEvent(projectRoot, BATCH_ID, "batch.started", {
			fromPhase: "planning",
			toPhase: "running",
		});
		appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-337" });

		const result = dismissBatch({ projectRoot, reason: "operator dismiss", force: true });
		assert.equal(result.ok, true);
		assert.equal(result.batchId, BATCH_ID);

		await waitForChildExit(child);
		assert.equal(isProcessAlive(child.pid), false, "stub worker must be killed on dismiss");

		const events = readJournalEvents(projectRoot, BATCH_ID);
		const terminated = events.filter((event) => event.type === "lane.worker_terminated");
		assert.equal(terminated.length, 1);
		assert.equal(terminated[0].payload?.workerPid, child.pid);
		assert.equal(terminated[0].laneId, "lane-1");
		assert.equal(terminated[0].payload?.reason, "batch_dismiss");
		assert.equal(terminated[0].payload?.signal, "SIGKILL");
	} finally {
		if (child.pid != null && isProcessAlive(child.pid)) {
			child.kill("SIGKILL");
		}
		await destroyGitRepo(projectRoot);
	}
});
