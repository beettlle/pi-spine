import assert from "node:assert/strict";
import test from "node:test";
import {
	DIAGNOSIS_TAXONOMY,
	buildAlternatives,
	buildDiagnosisOutput,
	buildHeadline,
	buildSuggestedCommand,
} from "../../src/batch/diagnosis.mjs";
import { deriveDiagnosis, reconcileBatch } from "../../src/batch/reconcile.mjs";

test("DIAGNOSIS_TAXONOMY includes needs_replan", () => {
	assert.ok(DIAGNOSIS_TAXONOMY.includes("needs_replan"));
});

test("needs_replan diagnosis messaging matches handoff §9.1 shape", () => {
	const ctx = {
		batchId: "20260610T140000",
		failedTaskId: "SP-042",
		tasksRoot: "spine-tasks",
	};

	const headline = buildHeadline("needs_replan", ctx);
	assert.equal(headline, "Task SP-042 needs replan — edit PROMPT.md before retry");

	const suggestedCommand = buildSuggestedCommand("needs_replan", ctx);
	assert.equal(
		suggestedCommand,
		"edit spine-tasks/SP-042/PROMPT.md then spine batch retry SP-042",
	);

	const alternatives = buildAlternatives("needs_replan", ctx);
	assert.deepEqual(alternatives, [
		"spine batch skip SP-042",
		"spine handoff",
		"spine status --diagnose",
	]);
});

test("buildDiagnosisOutput bundles needs_replan operator fields", () => {
	const output = buildDiagnosisOutput("needs_replan", {
		batchId: "20260610T140000",
		failedTaskId: "SP-042",
		tasksRoot: "spine-tasks",
	});

	assert.equal(output.diagnosis, "needs_replan");
	assert.match(output.headline, /needs replan/);
	assert.match(output.suggestedCommand, /edit spine-tasks\/SP-042\/PROMPT\.md/);
	assert.ok(output.alternatives.includes("spine handoff"));
});

test("deriveDiagnosis prefers needs_replan over needs_retry for replan failures", () => {
	const signals = {
		phase: "failed",
		endedAt: null,
		failedTasks: 1,
		allTasksTerminalSuccess: false,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: true,
		hasSegmentDrift: false,
		failedTaskId: "FX-153",
		mergeResultsEmpty: true,
		git: { orchBranchExists: true, orchMergedToBase: false },
		raw: {
			tasks: [
				{
					taskId: "FX-153",
					status: "failed",
					exitReason: "needs_replan",
					classification: "terminal-failure",
				},
			],
		},
	};

	const diagnosis = deriveDiagnosis(signals);
	assert.equal(diagnosis.diagnosis, "needs_replan");
	assert.equal(diagnosis.failedTaskId, "FX-153");
	assert.equal(diagnosis.exitReason, "needs_replan");
});

test("needs_replan blocks needs_merge diagnosis when replan task remains", () => {
	const signals = {
		phase: "merging",
		endedAt: null,
		failedTasks: 1,
		allTasksTerminalSuccess: true,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: true,
		hasSegmentDrift: false,
		failedTaskId: "FX-153",
		mergeResultsEmpty: true,
		git: { orchBranchExists: true, orchMergedToBase: false },
		raw: {
			tasks: [
				{
					taskId: "FX-153",
					status: "failed",
					exitReason: "needs_replan",
					classification: "terminal-failure",
				},
			],
		},
	};

	const diagnosis = deriveDiagnosis(signals);
	assert.equal(diagnosis.diagnosis, "needs_replan");
});

test("reconcileBatch surfaces needs_replan with edit-PROMPT suggestion", () => {
	const batchState = {
		batchId: "20260611T120400",
		phase: "failed",
		baseBranch: "main",
		orchBranch: "orch/spine-20260611T120400",
		startedAt: Date.now() - 60_000,
		endedAt: null,
		failedTasks: 1,
		succeededTasks: 0,
		totalTasks: 1,
		mergeResults: [],
		tasks: [
			{
				taskId: "FX-153",
				status: "failed",
				exitReason: "needs_replan",
				taskFolder: "test/fixtures/taskplane/FX-final-replan",
				doneFileFound: false,
				laneNumber: 1,
			},
		],
		segments: [{ segmentId: "FX-153::default", taskId: "FX-153", status: "failed" }],
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["FX-153"] }],
	};

	const result = reconcileBatch({
		projectRoot: process.cwd(),
		batchState,
		batchStatePath: ".spine/batch-state.json",
		verbose: true,
	});

	assert.equal(result.diagnosis, "needs_replan");
	assert.match(result.suggestedCommand, /edit .*FX-153.*PROMPT\.md/);
});
