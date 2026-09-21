import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { deriveDiagnosis, reconcileBatch } from "../../src/batch/reconcile.mjs";
import { listSalvageableLanes } from "../../src/batch/salvage-batch-list.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * Journal/state signals for a single failed task with configurable plan-review
 * exit reason and done evidence (#291 / SP-762).
 *
 * @param {{ exitReason: string, doneInLane: boolean, doneFileFound?: boolean }} options
 */
function postDonePlanReviewSignals({ exitReason, doneInLane, doneFileFound = false }) {
	return {
		phase: "running",
		failedTasks: 1,
		hasFailedTasks: true,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasSegmentDrift: false,
		allTasksTerminalSuccess: false,
		failedTaskId: "SP-075",
		mergeResultsEmpty: true,
		git: { orchMergedToBase: false, orchBranchExists: false },
		tasks: [
			{
				taskId: "SP-075",
				status: "failed",
				laneNumber: 1,
				exitReason,
				doneInLane,
				doneOnMain: false,
				doneFileFound,
				classification: "terminal-failure",
			},
		],
		journalEvents: [],
	};
}

test("deriveDiagnosis maps post-DONE plan review spawn failure to pending_lane_land", () => {
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_spawn_failed", doneInLane: true }));
	assert.equal(derived.diagnosis, "pending_lane_land");
	assert.equal(derived.failedTaskId, "SP-075");
});

test("deriveDiagnosis maps post-DONE plan review timeout to pending_lane_land", () => {
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_timeout", doneInLane: true }));
	assert.equal(derived.diagnosis, "pending_lane_land");
});

test("deriveDiagnosis accepts doneFileFound as post-DONE evidence", () => {
	const derived = deriveDiagnosis(
		postDonePlanReviewSignals({ exitReason: "plan_review_spawn_failed", doneInLane: false, doneFileFound: true }),
	);
	assert.equal(derived.diagnosis, "pending_lane_land");
});

test("deriveDiagnosis keeps needs_retry when plan review spawn failed without done evidence", () => {
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_spawn_failed", doneInLane: false }));
	assert.equal(derived.diagnosis, "needs_retry");
});

test("deriveDiagnosis keeps needs_retry for plan review invalid verdict after doneInLane", () => {
	// The reviewer ran and returned an unparseable verdict — that is not the
	// no-artifact spawn-failure timeline from #291.
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_invalid_verdict", doneInLane: true }));
	assert.equal(derived.diagnosis, "needs_retry");
});

test("deriveDiagnosis keeps needs_retry for code/final review spawn failure after doneInLane", () => {
	// SP-718 kept final/code review spawn failures on needs_retry with accurate
	// copy; SP-762 must not change that behavior.
	for (const exitReason of ["code_review_spawn_failed", "final_review_spawn_failed"]) {
		const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason, doneInLane: true }));
		assert.equal(derived.diagnosis, "needs_retry", exitReason);
	}
});

test("diagnose prefers salvage over worker retry after post-DONE plan review spawn failure (#291)", async () => {
	const projectRoot = await initGitRepo("post-done-plan-review-");
	const batchId = "testbatch291";
	const taskId = "SP-075";

	fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, "src", "main.js"), "base\n", "utf-8");
	execFileSync("git", ["add", "-A"], { cwd: projectRoot });
	execFileSync("git", ["commit", "-m", "feat: base"], { cwd: projectRoot });

	try {
		// Lane worktree with worker step-boundary commits ahead of base — the
		// #291 journal has no engine lane.committed event (the engine commit
		// phase never ran after the plan review spawn failure).
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		execFileSync("git", ["worktree", "add", "-B", `task/spine-lane-1-${batchId}`, wt, "main"], { cwd: projectRoot });
		fs.writeFileSync(path.join(wt, "src", "main.js"), "changed\n", "utf-8");
		const wtTaskFolder = path.join(wt, "spine-tasks", `${taskId}-mood`);
		fs.mkdirSync(wtTaskFolder, { recursive: true });
		fs.writeFileSync(path.join(wtTaskFolder, ".DONE"), "done\n", "utf-8");
		execFileSync("git", ["add", "-A"], { cwd: wt });
		execFileSync("git", ["commit", "-m", `feat(${taskId}): work`], { cwd: wt });

		// Contract artifacts on disk in the lane task folder (Phase-14 style).
		fs.mkdirSync(path.join(wtTaskFolder, "artifacts"), { recursive: true });
		fs.writeFileSync(path.join(wtTaskFolder, "artifacts", "verdict.md"), "APPROVE pending\n", "utf-8");

		// Task folder exists on main without .DONE so doneOnMain stays false.
		fs.mkdirSync(path.join(projectRoot, "spine-tasks", `${taskId}-mood`), { recursive: true });

		// Journal timeline mirroring #291 (batch 20260920T210357-2f86).
		appendJournalEvent(projectRoot, batchId, "batch.started", { id: batchId, baseBranch: "main" });
		appendJournalEvent(projectRoot, batchId, "lane.started", { laneNumber: 1, laneId: "lane-1", tasks: [taskId] });
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1, taskFolder: `${taskId}-mood` });
		appendJournalEvent(projectRoot, batchId, "worker.finished", { taskId, laneNumber: 1, doneFound: true, classification: "terminal-success" });
		appendJournalEvent(projectRoot, batchId, "review.failed", {
			taskId,
			reviewType: "plan",
			classification: "plan_review_spawn_failed",
			spawnFailed: true,
		});
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber: 1,
			classification: "plan_review_spawn_failed",
			exitReason: "plan_review_spawn_failed",
		});

		// Engine-persisted task state: recordPlanReviewTaskFailure sets status
		// "failed" + exitReason before the engine exits (issue #291 shows the
		// task as terminal-failure with exit plan_review_spawn_failed).
		const seedState = {
			id: batchId,
			tasksRoot: path.join(projectRoot, "spine-tasks"),
			lanes: [{ laneNumber: 1, taskIds: [taskId] }],
			tasks: [
				{
					taskId,
					taskFolder: `${taskId}-mood`,
					laneNumber: 1,
					status: "failed",
					exitReason: "plan_review_spawn_failed",
				},
			],
		};
		const { saveEngineBatchState } = await import("../../src/batch/pause.mjs");
		saveEngineBatchState(projectRoot, seedState);

		// Salvage eligibility (SP-718 pattern) must also hold for plan review:
		// lane commits exist and the failed task is salvageable, not excluded.
		const list = listSalvageableLanes(projectRoot, batchId);
		assert.equal(list.ok, true, `salvage list should succeed: ${JSON.stringify(list)}`);
		assert.equal(list.lanes?.length, 1, "should list 1 salvageable lane");
		assert.ok(list.lanes[0].commitsAhead > 0, "lane should have commits ahead");
		assert.deepEqual(list.lanes[0].salvageableTasks, [taskId]);

		const diagnosis = reconcileBatch({ projectRoot, batchId, verbose: true });
		assert.equal(diagnosis.diagnosis, "pending_lane_land");
		assert.match(diagnosis.headline, /salvage integrate/);
		assert.ok(diagnosis.headline.includes(taskId), `headline should name the task: ${diagnosis.headline}`);
		assert.doesNotMatch(diagnosis.headline, /worker died|retry or abort/);
		assert.equal(
			diagnosis.suggestedCommand,
			`spine batch salvage --batch ${batchId} --lane 1 --integrate`,
		);
		assert.doesNotMatch(diagnosis.suggestedCommand ?? "", /batch retry/);
		assert.ok(
			(diagnosis.alternatives ?? []).includes(`spine batch salvage --batch ${batchId} --dry-run`),
			`alternatives should offer salvage dry-run: ${JSON.stringify(diagnosis.alternatives)}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
