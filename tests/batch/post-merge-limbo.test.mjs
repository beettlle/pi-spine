import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { rm } from "node:fs/promises";
import test from "node:test";
import { initGitRepo } from "../helpers/git-fixture.mjs";
import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	finalizeBatchForIntegrate,
	isPostMergeLimbo,
} from "../../src/batch/post-merge-limbo.mjs";
import { deriveDiagnosis } from "../../src/batch/reconcile.mjs";
import { resumeMultiTaskBatch } from "../../src/batch/resume-multi.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

test("isPostMergeLimbo detects running phase with successful merges", () => {
	const state = {
		phase: "running",
		endedAt: null,
		tasks: [{ taskId: "SP-194", status: "succeeded" }],
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }],
	};
	assert.equal(isPostMergeLimbo(state, { orchBranchExists: true, orchMergedToBase: false }), true);
	assert.equal(isPostMergeLimbo({ ...state, phase: "completed" }), false);
});

test("deriveDiagnosis returns needs_integrate for post-merge limbo", () => {
	const diagnosis = deriveDiagnosis({
		phase: "running",
		endedAt: null,
		failedTasks: 0,
		allTasksTerminalSuccess: true,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: false,
		mergeResultsEmpty: false,
		git: { orchBranchExists: true, orchMergedToBase: false },
		raw: {
			phase: "running",
			tasks: [{ taskId: "SP-194", status: "succeeded" }],
			mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		},
	});
	assert.equal(diagnosis.diagnosis, "needs_integrate");
	assert.equal(
		buildSuggestedCommand("needs_integrate", { postMergeLimbo: true, phase: "running" }),
		"spine batch resume",
	);
	assert.equal(
		buildSuggestedCommand("needs_integrate", {
			postMergeLimbo: true,
			phase: "running",
			integrateGateOpen: true,
		}),
		"spine gate approve",
	);
});

test("finalizeBatchForIntegrate opens gate from post-merge limbo without resume", async () => {
	const projectRoot = await initGitRepo("spine-post-merge-finalize-");
	const batchId = "20260617T231658";
	const taskId = "SP-280";
	const orchBranch = `orch/spine-${batchId}`;

	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: path.join("spine-tasks", `${taskId}-limbo`),
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: [taskId],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "cafebabe" }];
		saveSpineBatchState(projectRoot, state);

		assert.equal(isPostMergeLimbo(loadSpineBatchState(projectRoot).raw), true);

		const result = finalizeBatchForIntegrate({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId,
			orchBranch,
			resumed: false,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		const events = readJournalEvents(projectRoot, batchId);
		const completed = events.filter((event) => event.type === "batch.completed");
		assert.equal(completed.length, 1);
		assert.equal(completed[0]?.payload?.resumed, false);
		assert.equal(completed[0]?.payload?.postMergeLimbo, true);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("resumeMultiTaskBatch opens gate from post-merge limbo without re-running tasks", async () => {
	const projectRoot = await initGitRepo("spine-post-merge-limbo-");
	const batchId = "20260612T011148";
	const taskId = "SP-194";
	const orchBranch = `orch/spine-${batchId}`;

	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: path.join("spine-tasks", `${taskId}-limbo`),
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: [taskId],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "deadbeef" }];
		saveSpineBatchState(projectRoot, state);

		const result = await resumeMultiTaskBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		const events = readJournalEvents(projectRoot, batchId);
		const gateOpened = events.filter((event) => event.type === "gate.opened");
		assert.equal(gateOpened.length, 1, "gate.opened should not duplicate");
		assert.ok(events.some((event) => event.type === "batch.completed"));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
