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

test("deriveDiagnosis maps post-DONE plan review spawn failure to needs_retry re-review (SP-821 reverses SP-762)", () => {
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_spawn_failed", doneInLane: true }));
	assert.equal(derived.diagnosis, "needs_retry");
	assert.equal(derived.failedTaskId, "SP-075");
});

test("deriveDiagnosis maps post-DONE plan review timeout to needs_retry re-review", () => {
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_timeout", doneInLane: true }));
	assert.equal(derived.diagnosis, "needs_retry");
});

test("deriveDiagnosis accepts doneFileFound as post-DONE evidence", () => {
	const derived = deriveDiagnosis(
		postDonePlanReviewSignals({ exitReason: "plan_review_spawn_failed", doneInLane: false, doneFileFound: true }),
	);
	assert.equal(derived.diagnosis, "needs_retry");
});

test("deriveDiagnosis maps post-DONE plan review provider error to needs_retry re-review", () => {
	// SP-820 added provider-error exit reasons; SP-821 treats them as
	// review-infrastructure failures like spawn failure and timeout.
	const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason: "plan_review_provider_error", doneInLane: true }));
	assert.equal(derived.diagnosis, "needs_retry");
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
	// SP-718 kept final/code review spawn failures on needs_retry; SP-821 keeps
	// them there and extends the same re-review semantics to plan review.
	for (const exitReason of ["code_review_spawn_failed", "final_review_spawn_failed"]) {
		const derived = deriveDiagnosis(postDonePlanReviewSignals({ exitReason, doneInLane: true }));
		assert.equal(derived.diagnosis, "needs_retry", exitReason);
	}
});

test("diagnose recommends re-review over salvage after post-DONE plan review spawn failure (SP-821 reverses #291)", async () => {
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
		await saveEngineBatchState(projectRoot, seedState);

		// Salvage eligibility (SP-718 pattern) must also hold for plan review:
		// lane commits exist and the failed task is salvageable, not excluded.
		// The lane stays salvageable, but diagnose no longer recommends landing
		// it unreviewed — SP-821 sends the operator back to the review instead.
		const list = listSalvageableLanes(projectRoot, batchId);
		assert.equal(list.ok, true, `salvage list should succeed: ${JSON.stringify(list)}`);
		assert.equal(list.lanes?.length, 1, "should list 1 salvageable lane");
		assert.ok(list.lanes[0].commitsAhead > 0, "lane should have commits ahead");
		assert.deepEqual(list.lanes[0].salvageableTasks, [taskId]);

		const diagnosis = reconcileBatch({ projectRoot, batchId, verbose: true });
		assert.equal(diagnosis.diagnosis, "needs_retry");
		assert.match(diagnosis.headline, /plan review produced no verdict/);
		assert.match(diagnosis.headline, /re-run the review/);
		assert.ok(diagnosis.headline.includes(taskId), `headline should name the task: ${diagnosis.headline}`);
		assert.ok(diagnosis.headline.includes("lane work is done"), `headline should say lane work is done: ${diagnosis.headline}`);
		assert.doesNotMatch(diagnosis.headline, /salvage integrate|worker died|retry or abort/);
		assert.equal(diagnosis.suggestedCommand, `spine batch retry ${taskId}`);
		assert.doesNotMatch(diagnosis.suggestedCommand ?? "", /salvage/);
		assert.ok(
			(diagnosis.alternatives ?? []).some((entry) =>
				typeof entry === "string" &&
				entry.includes(`spine batch salvage --batch ${batchId} --dry-run`) &&
				entry.includes("lands unreviewed work"),
			),
			`alternatives should offer salvage dry-run labeled as landing unreviewed work: ${JSON.stringify(diagnosis.alternatives)}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
