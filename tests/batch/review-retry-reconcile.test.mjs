/**
 * SP-538 — retry-reconcile review honor visibility (GitHub #188).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildHeadline } from "../../src/batch/diagnosis.mjs";
import { runCodeReviewPhase } from "../../src/batch/engine-lanes/review.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	isRetryReconcileFreshReview,
	resolveReviewHonorJournalEvent,
	REVIEW_HONOR_JOURNAL_EVENTS,
	shouldEmitReviewResumed,
} from "../../src/batch/review.mjs";
import { buildReviewArtifactPath } from "../../src/batch/review-shared.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_ID = "SP-538";
const BATCH_ID = "20260707T164359";

function execCommit(cwd, message) {
	execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

/**
 * @param {string} artifactPath
 */
function writeApproveArtifact(artifactPath) {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const body = [
		"## Code Review",
		"",
		"### Verdict: APPROVE",
		"",
		"### Summary",
		"Prior code review APPROVE from retry-reconcile fixture.",
		"",
		"```json",
		JSON.stringify({ verdict: "APPROVE", feedback: "Fixture APPROVE." }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}

/**
 * Issue #188 journal shape: code review APPROVE, contract_failed, retry, reconcile.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 */
function seedRetryReconcileJournal(projectRoot, batchId) {
	appendJournalEvent(projectRoot, batchId, "review.completed", {
		taskId: TASK_ID,
		reviewType: "code",
		verdict: "APPROVE",
		feedback: "Prior APPROVE",
	});
	appendJournalEvent(projectRoot, batchId, "contract.failed", { taskId: TASK_ID });
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId: TASK_ID,
		classification: "contract_failed",
	});
	appendJournalEvent(projectRoot, batchId, "task.retry_requested", { taskId: TASK_ID });
	appendJournalEvent(projectRoot, batchId, "task.completed", {
		taskId: TASK_ID,
		reconciled: true,
		reconcileReason: "done_in_lane_terminal",
		skippedDoneOnDisk: true,
	});
}

/**
 * @param {string} projectRoot
 */
function writeReviewLevel2Task(projectRoot) {
	const taskFolderRel = `spine-tasks/${TASK_ID}-retry-reconcile`;
	const taskFolder = path.join(projectRoot, taskFolderRel);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${TASK_ID}

## Review Level: 2 (Plan + Code)

## Mission
Retry-reconcile review honor fixture (issue #188).

## File Scope
- \`src/review-retry-fixture.txt\`

## Steps
### Step 2: Code review checkpoint
> **Code review checkpoint**
- [ ] verify
`,
		"utf-8",
	);
	return { taskFolderRel, taskFolder };
}

/**
 * @param {string} projectRoot
 */
async function provisionRetryReconcileLane(projectRoot) {
	const { taskFolderRel, taskFolder } = writeReviewLevel2Task(projectRoot);
	execCommit(projectRoot, "review retry reconcile fixture");

	const orchBranch = `orch/spine-${BATCH_ID}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const wt = laneWorktreePath(projectRoot, BATCH_ID, 1);
	provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });

	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	fs.mkdirSync(path.dirname(path.join(wt, "src/review-retry-fixture.txt")), { recursive: true });
	fs.writeFileSync(path.join(wt, "src/review-retry-fixture.txt"), "fixture\n", "utf-8");
	fs.mkdirSync(taskFolderInWorktree, { recursive: true });
	fs.copyFileSync(path.join(taskFolder, "PROMPT.md"), path.join(taskFolderInWorktree, "PROMPT.md"));
	fs.writeFileSync(
		path.join(taskFolderInWorktree, ".DONE"),
		JSON.stringify({ taskId: TASK_ID, completedAt: new Date().toISOString() }, null, 2),
		"utf-8",
	);

	const stepNumber = 2;
	const artifactPath = buildReviewArtifactPath(taskFolderInWorktree, stepNumber);
	writeApproveArtifact(artifactPath);
	execCommit(wt, "lane retry reconcile fixture");

	seedRetryReconcileJournal(projectRoot, BATCH_ID);

	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "running",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 60_000,
				endedAt: null,
				doneFileFound: true,
				exitReason: null,
				codeReviewAttempts: 1,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_ID],
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);

	return { state, lane: state.lanes[0], task: state.tasks[0], wt, taskFolderInWorktree };
}

test("isRetryReconcileFreshReview true after retry following review.completed", () => {
	const journalEvents = [
		{ type: "review.completed", taskId: TASK_ID, payload: { reviewType: "code", verdict: "APPROVE" } },
		{ type: "task.failed", taskId: TASK_ID, payload: { classification: "contract_failed" } },
		{ type: "task.retry_requested", taskId: TASK_ID, payload: {} },
	];
	assert.equal(
		isRetryReconcileFreshReview({
			journalEvents,
			taskId: TASK_ID,
			reviewType: "code",
			honorSource: "journal",
		}),
		true,
	);
});

test("resolveReviewHonorJournalEvent prefers skipped_fresh_artifact on retry-reconcile", () => {
	const journalEvents = [
		{ type: "review.completed", taskId: TASK_ID, payload: { reviewType: "code", verdict: "APPROVE" } },
		{ type: "task.retry_requested", taskId: TASK_ID, payload: {} },
	];
	assert.equal(
		resolveReviewHonorJournalEvent({
			journalEvents,
			taskId: TASK_ID,
			reviewType: "code",
			honorSource: "journal",
			reviewAttempt: 1,
		}),
		REVIEW_HONOR_JOURNAL_EVENTS.skippedFreshArtifact,
	);
});

test("resolveReviewHonorJournalEvent emits crash_recovered for orphaned review.started", () => {
	const journalEvents = [
		{
			type: "review.started",
			taskId: TASK_ID,
			payload: { reviewType: "code", artifactPath: "/tmp/review.md" },
		},
	];
	assert.equal(
		resolveReviewHonorJournalEvent({
			journalEvents,
			taskId: TASK_ID,
			reviewType: "code",
			honorSource: "artifact",
			reviewAttempt: 1,
		}),
		REVIEW_HONOR_JOURNAL_EVENTS.crashRecovered,
	);
});

test("runCodeReviewPhase honors fresh artifact with skipped_fresh_artifact not crash_recovered", async () => {
	const projectRoot = await initGitRepo("spine-review-retry-reconcile-");
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const { state, lane, task, wt, taskFolderInWorktree } = await provisionRetryReconcileLane(
			projectRoot,
		);

		const result = await runCodeReviewPhase({
			projectRoot,
			state,
			batchId: BATCH_ID,
			config: { review: { maxFinalAttempts: 3 } },
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-sp538",
			fileScopePaths: ["src/review-retry-fixture.txt"],
		});

		assert.equal(result.ok, true);
		assert.equal(result.honored, true);
		assert.equal(result.verdict, "APPROVE");

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(
			events.some((event) => event.type === "review.skipped_fresh_artifact"),
			"expected review.skipped_fresh_artifact",
		);
		assert.equal(
			events.some((event) => event.type === "review.crash_recovered"),
			false,
			"retry-reconcile must not emit review.crash_recovered",
		);

		const verdictRecorded = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.payload?.reviewType === "code" &&
				event.payload?.honored === true,
		);
		assert.equal(verdictRecorded?.payload?.reviewPassKind, "fresh_skip");
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		await destroyGitRepo(projectRoot);
	}
});

test("runCodeReviewPhase emits review.resumed when spawning after retry without honored artifact", async () => {
	const projectRoot = await initGitRepo("spine-review-resumed-");
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const { taskFolderRel, taskFolder } = writeReviewLevel2Task(projectRoot);
		execCommit(projectRoot, "review resumed fixture");

		const orchBranch = `orch/spine-${BATCH_ID}-resume`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const batchId = BATCH_ID + "-resume";
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

		const taskFolderInWorktree = path.join(wt, taskFolderRel);
		fs.mkdirSync(taskFolderInWorktree, { recursive: true });
		fs.copyFileSync(path.join(taskFolder, "PROMPT.md"), path.join(taskFolderInWorktree, "PROMPT.md"));
		fs.writeFileSync(
			path.join(taskFolderInWorktree, ".DONE"),
			JSON.stringify({ taskId: TASK_ID, completedAt: new Date().toISOString() }, null, 2),
			"utf-8",
		);
		execCommit(wt, "lane resumed fixture");

		appendJournalEvent(projectRoot, batchId, "task.retry_requested", { taskId: TASK_ID });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[TASK_ID]],
			tasks: [
				{
					taskId: TASK_ID,
					laneNumber: 1,
					status: "running",
					taskFolder: taskFolderRel,
					codeReviewAttempts: 0,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: wt,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [TASK_ID],
				},
			],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const journalEvents = readJournalEvents(projectRoot, batchId);
		assert.equal(shouldEmitReviewResumed({ journalEvents, taskId: TASK_ID }), true);

		const result = await runCodeReviewPhase({
			projectRoot,
			state,
			batchId,
			config: { review: { maxFinalAttempts: 3 } },
			task: state.tasks[0],
			lane: state.lanes[0],
			taskFolderInWorktree,
			wt,
			taskBranch: state.lanes[0].branch,
			laneCorrelationId: "corr-sp538-resume",
			fileScopePaths: ["src/review-retry-fixture.txt"],
		});

		assert.equal(result.ok, true);
		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "review.resumed"));
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		await destroyGitRepo(projectRoot);
	}
});

test("buildHeadline surfaces review.crash_recovered for running batch", () => {
	const headline = buildHeadline("running", {
		batchId: BATCH_ID,
		reviewHonorSignal: {
			taskId: TASK_ID,
			reviewType: "code",
			kind: "review.crash_recovered",
			honorSource: "artifact",
		},
	});
	assert.match(headline, /recovered code review crash/i);
	assert.match(headline, /SP-538/);
});
