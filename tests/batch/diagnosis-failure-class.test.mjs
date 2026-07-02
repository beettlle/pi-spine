import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	buildDiagnosisOutput,
	buildHeadline,
	buildSuggestedCommand,
	inferLaunchFailureKind,
} from "../../src/batch/diagnosis.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("inferLaunchFailureKind ignores DirtyWorktree exitReason", () => {
	assert.equal(
		inferLaunchFailureKind({
			exitReason: "DirtyWorktree",
			journalEvents: [
				{
					type: "task.failed",
					taskId: "SP-001",
					payload: {
						taskId: "SP-001",
						classification: "DirtyWorktree",
						output: "lane worktree dirty: extension/coverage/lcov.info",
					},
				},
			],
			failedTaskId: "SP-001",
		}),
		null,
	);
});

test("buildHeadline prefers DirtyWorktree over worker launch", () => {
	const headline = buildHeadline("needs_retry", {
		batchId: "20260701T201456",
		failedTaskId: "SP-001",
		exitReason: "DirtyWorktree",
		launchFailureKind: null,
	});
	assert.doesNotMatch(headline, /failed at worker launch/i);
	assert.match(headline, /dirty lane worktree/i);
	assert.match(headline, /SP-001/);
});

test("buildSuggestedCommand for DirtyWorktree suggests coverage cleanup and retry", () => {
	assert.equal(
		buildSuggestedCommand("needs_retry", {
			failedTaskId: "SP-001",
			exitReason: "DirtyWorktree",
		}),
		"git checkout -- extension/coverage && spine batch retry SP-001",
	);
});

test("buildHeadline surfaces review_exhausted primary failure", () => {
	const headline = buildHeadline("needs_retry", {
		batchId: "20260701T201456",
		failedTaskId: "SP-002",
		exitReason: "review_exhausted",
	});
	assert.doesNotMatch(headline, /failed at worker launch/i);
	assert.match(headline, /exhausted final review attempts/i);
	assert.match(headline, /SP-002/);
});

test("buildSuggestedCommand for review_exhausted suggests batch retry", () => {
	assert.equal(
		buildSuggestedCommand("needs_retry", {
			failedTaskId: "SP-002",
			exitReason: "review_exhausted",
		}),
		"spine batch retry SP-002",
	);
});

test("buildHeadline surfaces contract_failed primary failure", () => {
	const headline = buildHeadline("needs_retry", {
		batchId: "20260701T201456",
		failedTaskId: "SP-003",
		exitReason: "contract_failed",
	});
	assert.doesNotMatch(headline, /failed at worker launch/i);
	assert.match(headline, /failed contract verification/i);
	assert.match(headline, /SP-003/);
});

test("buildSuggestedCommand for contract_failed suggests PROMPT edit and retry", () => {
	assert.equal(
		buildSuggestedCommand("needs_retry", {
			failedTaskId: "SP-003",
			exitReason: "contract_failed",
			tasksRoot: "spine-tasks",
		}),
		"edit spine-tasks/SP-003/PROMPT.md then spine batch retry SP-003",
	);
});

test("buildDiagnosisOutput bundles primary failure class without launch headline", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: "20260701T201456",
		failedTaskId: "SP-001",
		exitReason: "DirtyWorktree",
	});
	assert.doesNotMatch(output.headline, /failed at worker launch/i);
	assert.match(output.suggestedCommand, /spine batch retry SP-001/);
});

test("reconcileBatch aligns hasFailedTasks with segment drift and DirtyWorktree headline", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-failure-class-drift-");
	try {
		const batchId = "20260701T201456";
		const taskId = "SP-001";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "pending",
					taskFolder: `spine-tasks/${taskId}-diagnosis`,
					startedAt: null,
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
		state.phase = "failed";
		state.failedTasks = 5;
		state.segments = [
			{
				segmentId: `${taskId}::default`,
				taskId,
				status: "failed",
				classification: "terminal-failure",
			},
		];
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber: 1,
			classification: "DirtyWorktree",
			exitReason: "DirtyWorktree",
			output: "lane commit refused: dirty worktree extension/coverage/lcov.info",
		});

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "needs_retry");
		assert.equal(result.signals?.hasFailedTasks, true);
		assert.equal(result.signals?.hasSegmentDrift, true);
		assert.equal(result.signals?.failedTasks, 5);
		assert.doesNotMatch(result.headline, /failed at worker launch/i);
		assert.match(result.headline, /dirty lane worktree/i);
		assert.equal(result.suggestedCommand, "git checkout -- extension/coverage && spine batch retry SP-001");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch diagnoses review_exhausted from failed task exitReason", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-review-exhausted-");
	try {
		const batchId = "20260701T201456";
		const taskId = "SP-002";
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
					taskFolder: `spine-tasks/${taskId}-review`,
					startedAt: Date.now() - 120_000,
					endedAt: Date.now() - 60_000,
					doneFileFound: false,
					exitReason: "review_exhausted",
					classification: "terminal-failure",
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
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "review.exhausted", {
			taskId,
			laneNumber: 1,
			finalAttempt: 3,
			maxFinalAttempts: 3,
		});

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "needs_retry");
		assert.equal(result.signals?.hasFailedTasks, true);
		assert.doesNotMatch(result.headline, /failed at worker launch/i);
		assert.match(result.headline, /exhausted final review attempts/i);
		assert.equal(result.suggestedCommand, "spine batch retry SP-002");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
