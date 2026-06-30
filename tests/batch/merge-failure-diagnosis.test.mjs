import assert from "node:assert/strict";
import test from "node:test";
import { runSpineStatus } from "../../bin/spine-status.mjs";
import {
	buildDiagnosisOutput,
	buildHeadline,
	buildMergeFailureHeadline,
	buildSuggestedCommand,
	summarizeMergeFailures,
} from "../../src/batch/diagnosis.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260625T025547";
const MERGE_CONFLICT_ERROR =
	"merge conflict on internal/safety/revert.go, internal/safety/revert_test.go";

function buildSucceededTask(taskId, laneNumber) {
	return {
		taskId,
		laneNumber,
		status: "succeeded",
		taskFolder: `spine-tasks/${taskId}`,
		startedAt: Date.now(),
		endedAt: Date.now(),
		doneFileFound: true,
		exitReason: null,
	};
}

function buildPendingTask(taskId, laneNumber) {
	return {
		taskId,
		laneNumber,
		status: "pending",
		taskFolder: `spine-tasks/${taskId}`,
		startedAt: null,
		endedAt: null,
		doneFileFound: false,
		exitReason: null,
	};
}

function buildMergeFailureBatchState() {
	const succeededIds = Array.from({ length: 13 }, (_, index) => `TASK-${String(index + 1).padStart(3, "0")}`);
	const pendingIds = Array.from({ length: 7 }, (_, index) => `TASK-${String(index + 14).padStart(3, "0")}`);
	const wavePlan = [
		...succeededIds.slice(0, 3).map((taskId) => [taskId]),
		...succeededIds.slice(3, 7).map((taskId) => [taskId]),
		...succeededIds.slice(7, 10).map((taskId) => [taskId]),
		...succeededIds.slice(10, 13).map((taskId) => [taskId]),
		[pendingIds[0]],
		pendingIds.slice(1, 4),
		pendingIds.slice(4, 7),
	];

	const tasks = [
		...succeededIds.map((taskId, index) => buildSucceededTask(taskId, (index % 3) + 1)),
		...pendingIds.map((taskId, index) => buildPendingTask(taskId, (index % 3) + 1)),
	];

	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan,
		tasks,
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", worktreePath: "/tmp/lane-1", branch: `task/spine-lane-1-${BATCH_ID}`, taskIds: [], lastHeartbeatAt: null, workerPid: null },
			{ laneNumber: 2, laneId: "lane-2", worktreePath: "/tmp/lane-2", branch: `task/spine-lane-2-${BATCH_ID}`, taskIds: [], lastHeartbeatAt: null, workerPid: null },
			{ laneNumber: 3, laneId: "lane-3", worktreePath: "/tmp/lane-3", branch: `task/spine-lane-3-${BATCH_ID}`, taskIds: [], lastHeartbeatAt: null, workerPid: null },
		],
	});
	state.phase = "failed";
	state.succeededTasks = 13;
	state.failedTasks = 0;
	state.totalTasks = 20;
	state.currentWaveIndex = 4;
	state.lastError = MERGE_CONFLICT_ERROR;
	state.mergeResults = [
		{ waveIndex: 0, status: "succeeded", mergeCommit: "aaa111" },
		{ waveIndex: 1, status: "succeeded", mergeCommit: "bbb222" },
		{ waveIndex: 2, status: "succeeded", mergeCommit: "ccc333" },
		{ waveIndex: 3, status: "succeeded", mergeCommit: "ddd444" },
		{
			waveIndex: 4,
			status: "failed",
			failedLane: 1,
			failureReason: MERGE_CONFLICT_ERROR,
		},
	];
	return state;
}

test("summarizeMergeFailures extracts failed wave and lane from mergeResults", () => {
	const summary = summarizeMergeFailures(
		[
			{ waveIndex: 3, status: "succeeded" },
			{ waveIndex: 4, status: "failed", failedLane: 1, failureReason: MERGE_CONFLICT_ERROR },
		],
		MERGE_CONFLICT_ERROR,
	);
	assert.equal(summary.mergeFailed, true);
	assert.equal(summary.failedMerges, 1);
	assert.equal(summary.failedWaveIndex, 4);
	assert.equal(summary.failedLane, 1);
	assert.equal(summary.lastError, MERGE_CONFLICT_ERROR);
});

test("buildMergeFailureHeadline uses 1-based wave number and lane label", () => {
	const headline = buildMergeFailureHeadline(`Batch ${BATCH_ID}`, {
		failedWaveIndex: 4,
		failedLane: 1,
		lastError: MERGE_CONFLICT_ERROR,
		succeededTasks: 13,
		totalTasks: 20,
	});
	assert.match(headline, /wave 5 merge conflict on lane-1/);
	assert.match(headline, /13\/20 tasks succeeded/);
	assert.match(headline, /revert\.go/);
});

test("buildHeadline for failed diagnosis surfaces merge conflict instead of zero failed tasks", () => {
	const headline = buildHeadline("failed", {
		batchId: BATCH_ID,
		failedTasks: 0,
		mergeFailed: true,
		failedWaveIndex: 4,
		failedLane: 1,
		lastError: MERGE_CONFLICT_ERROR,
		succeededTasks: 13,
		totalTasks: 20,
	});
	assert.doesNotMatch(headline, /0 failed task\(s\)/);
	assert.match(headline, /wave 5 merge conflict on lane-1/);
});

test("buildSuggestedCommand for merge failure suggests resume --force", () => {
	assert.equal(
		buildSuggestedCommand("failed", { mergeFailed: true }),
		"spine batch resume --force",
	);
	assert.equal(
		buildSuggestedCommand("needs_retry", { mergeFailed: true }),
		"spine batch resume --force",
	);
});

test("buildDiagnosisOutput bundles merge failure headline and command", () => {
	const output = buildDiagnosisOutput("failed", {
		batchId: BATCH_ID,
		mergeFailed: true,
		failedWaveIndex: 4,
		failedLane: 1,
		lastError: MERGE_CONFLICT_ERROR,
		succeededTasks: 13,
		totalTasks: 20,
	});
	assert.match(output.headline, /wave 5 merge conflict on lane-1/);
	assert.equal(output.suggestedCommand, "spine batch resume --force");
});

test("reconcileBatch surfaces merge failure fields distinct from failedTasks", async () => {
	const projectRoot = await initGitRepo("spine-merge-failure-diagnosis-");
	try {
		saveSpineBatchState(projectRoot, buildMergeFailureBatchState());
		const reconciliation = reconcileBatch({ projectRoot, verbose: true });

		assert.equal(reconciliation.failedTasks, 0);
		assert.equal(reconciliation.mergeFailed, true);
		assert.equal(reconciliation.failedMerges, 1);
		assert.equal(reconciliation.failedWaveIndex, 4);
		assert.equal(reconciliation.failedLane, 1);
		assert.equal(reconciliation.lastError, MERGE_CONFLICT_ERROR);
		assert.match(reconciliation.headline, /wave 5 merge conflict on lane-1/);
		assert.doesNotMatch(reconciliation.headline, /0 failed task\(s\)/);
		assert.equal(reconciliation.suggestedCommand, "spine batch resume --force");
		assert.equal(reconciliation.signals?.mergeFailed, true);
		assert.equal(reconciliation.signals?.failedMerges, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --json includes merge failure fields for monitors", async () => {
	const projectRoot = await initGitRepo("spine-merge-failure-status-json-");
	try {
		saveSpineBatchState(projectRoot, buildMergeFailureBatchState());
		const { output } = runSpineStatus({ projectRoot, json: true });
		const parsed = JSON.parse(output);

		assert.equal(parsed.failedTasks, 0);
		assert.equal(parsed.mergeFailed, true);
		assert.equal(parsed.failedMerges, 1);
		assert.equal(parsed.failedWaveIndex, 4);
		assert.equal(parsed.failedLane, 1);
		assert.equal(parsed.lastError, MERGE_CONFLICT_ERROR);
		assert.match(parsed.headline, /wave 5 merge conflict on lane-1/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --diagnose prints merge failure details in text output", async () => {
	const projectRoot = await initGitRepo("spine-merge-failure-status-diagnose-");
	try {
		saveSpineBatchState(projectRoot, buildMergeFailureBatchState());
		const { output } = runSpineStatus({ projectRoot, diagnose: true });

		assert.match(output, /wave 5 merge conflict on lane-1/);
		assert.match(output, /Merge failed: 1 wave\(s\)/);
		assert.match(output, /Failed wave: 5 \(index 4\)/);
		assert.match(output, /Failed lane: 1/);
		assert.match(output, /Last error:.*revert\.go/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
