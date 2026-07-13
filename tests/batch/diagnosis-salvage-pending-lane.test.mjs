/**
 * SP-645 — diagnose suggests salvage integrate for pending lane land (#201).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import {
	buildAlternatives,
	buildDiagnosisOutput,
	buildHeadline,
	buildPendingLaneLandSuggestedCommand,
	buildSuggestedCommand,
	findPendingLaneLandTasks,
	shouldDiagnosePendingLaneLand,
} from "../../src/batch/diagnosis.mjs";
import { deriveDiagnosis } from "../../src/batch/reconcile-diagnosis.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260601T120000";
const TASK_ID = "TP-012";
const TASK_FOLDER = "TP-012-single-lane-worker";

const pendingLaneLandTask = {
	taskId: TASK_ID,
	status: "succeeded",
	taskFolder: TASK_FOLDER,
	doneFileFound: true,
	doneInLane: true,
	doneOnMain: false,
	laneNumber: 1,
	classification: "terminal-success",
};

const terminalSuccessSignals = {
	allTasksTerminalSuccess: true,
	mergeResultsEmpty: false,
	git: { orchMergedToBase: true },
	tasks: [pendingLaneLandTask],
};

test("findPendingLaneLandTasks selects doneInLane without doneOnMain", () => {
	const tasks = [
		{ taskId: "A", doneInLane: true, doneOnMain: false },
		{ taskId: "B", doneInLane: true, doneOnMain: true },
		{ taskId: "C", doneFileFound: true },
	];
	assert.deepEqual(findPendingLaneLandTasks(tasks).map((task) => task.taskId), ["A"]);
});

test("shouldDiagnosePendingLaneLand when terminal success and merge satisfied", () => {
	assert.equal(shouldDiagnosePendingLaneLand(terminalSuccessSignals), true);
	assert.equal(
		shouldDiagnosePendingLaneLand({
			...terminalSuccessSignals,
			allTasksTerminalSuccess: false,
			stateDrift: { drifted: false },
		}),
		false,
	);
	assert.equal(
		shouldDiagnosePendingLaneLand({
			...terminalSuccessSignals,
			mergeResultsEmpty: true,
			git: { orchMergedToBase: false },
		}),
		false,
	);
});

test("shouldDiagnosePendingLaneLand when state_drift with pending lane land", () => {
	assert.equal(
		shouldDiagnosePendingLaneLand({
			tasks: [pendingLaneLandTask],
			allTasksTerminalSuccess: false,
			stateDrift: { drifted: true },
			git: { orchMergedToBase: true },
		}),
		true,
	);
	assert.equal(
		shouldDiagnosePendingLaneLand({
			tasks: [pendingLaneLandTask],
			allTasksTerminalSuccess: false,
			stateDrift: { drifted: true },
			git: { orchMergedToBase: false },
		}),
		false,
	);
});

test("buildPendingLaneLandSuggestedCommand matches SP-644 salvage integrate shape", () => {
	assert.equal(
		buildPendingLaneLandSuggestedCommand(BATCH_ID, [pendingLaneLandTask]),
		`spine batch salvage --batch ${BATCH_ID} --lane 1 --integrate`,
	);
	assert.equal(
		buildPendingLaneLandSuggestedCommand(BATCH_ID, [{ taskId: TASK_ID }]),
		`spine batch salvage --batch ${BATCH_ID} --dry-run`,
	);
});

test("buildSuggestedCommand prefers salvage integrate over batch complete for pending lane land", () => {
	const command = buildSuggestedCommand("pending_lane_land", {
		batchId: BATCH_ID,
		pendingLaneLandTasks: [pendingLaneLandTask],
	});
	assert.equal(command, `spine batch salvage --batch ${BATCH_ID} --lane 1 --integrate`);
	assert.doesNotMatch(command, /batch complete/);
});

test("buildSuggestedCommand for pending_lane_land suggests salvage not resume", () => {
	const command = buildSuggestedCommand("pending_lane_land", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		allTasksTerminalSuccess: true,
		pendingLaneLandTasks: [pendingLaneLandTask],
	});
	assert.equal(command, `spine batch salvage --batch ${BATCH_ID} --lane 1 --integrate`);
	assert.doesNotMatch(command, /resume --force/);
});

test("buildHeadline describes pending lane land not ready to archive", () => {
	const headline = buildHeadline("pending_lane_land", {
		batchId: BATCH_ID,
		baseBranch: "main",
		pendingLaneLandTasks: [pendingLaneLandTask],
	});
	assert.match(headline, /lane work not on main/i);
	assert.match(headline, new RegExp(TASK_ID));
	assert.doesNotMatch(headline, /completed successfully/i);
});

test("buildAlternatives offers dry-run not batch complete for pending lane land", () => {
	const alternatives = buildAlternatives("pending_lane_land", {
		batchId: BATCH_ID,
		pendingLaneLandTasks: [pendingLaneLandTask],
	});
	assert.ok(alternatives.some((entry) => entry.includes("--dry-run")));
	assert.ok(!alternatives.some((entry) => entry.includes("batch complete")));
});

test("deriveDiagnosis returns pending_lane_land for terminal success with pending lane land", () => {
	const derived = deriveDiagnosis(terminalSuccessSignals);
	assert.equal(derived.diagnosis, "pending_lane_land");
	assert.equal(derived.failedTaskId, TASK_ID);
});

test("buildDiagnosisOutput wires pending_lane_land salvage primary command", () => {
	const output = buildDiagnosisOutput("pending_lane_land", {
		batchId: BATCH_ID,
		baseBranch: "main",
		pendingLaneLandTasks: [pendingLaneLandTask],
	});
	assert.equal(output.diagnosis, "pending_lane_land");
	assert.equal(
		output.suggestedCommand,
		`spine batch salvage --batch ${BATCH_ID} --lane 1 --integrate`,
	);
	assert.match(output.headline, /salvage integrate/i);
	assert.ok(!output.alternatives.some((entry) => entry.includes("batch complete")));
});

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

function pendingLaneLandFixture(orchBranch, batchId = BATCH_ID) {
	const taskBranch = laneTaskBranch(batchId, 1);
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [
			{
				waveIndex: 0,
				status: "succeeded",
				failedLane: null,
				failureReason: null,
				mergeCommit: "deadbeef",
			},
		],
		tasks: [
			{
				taskId: TASK_ID,
				status: "succeeded",
				taskFolder: TASK_FOLDER,
				doneFileFound: true,
				laneNumber: 1,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: `.worktrees/spine-${batchId}/lane-1`,
				branch: taskBranch,
				taskIds: [TASK_ID],
			},
		],
		segments: [{ segmentId: `${TASK_ID}::default`, taskId: TASK_ID, status: "succeeded" }],
	};
}

function setupLaneDoneNotOnMain(projectRoot, batchId, taskFolder) {
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = laneTaskBranch(batchId, 1);
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync("git", ["worktree", "add", "-b", taskBranch, wt, orchBranch], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	const laneTaskFolder = path.join(wt, "spine-tasks", taskFolder);
	fs.mkdirSync(laneTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "", "utf-8");
}

test("reconcileBatch diagnose suggests salvage integrate for #201 pending lane land", async () => {
	const projectRoot = await initGitRepo("spine-diagnose-pending-lane-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = pendingLaneLandFixture(orchBranch);
		setupLaneDoneNotOnMain(projectRoot, BATCH_ID, fixture.tasks[0].taskFolder);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId: BATCH_ID, batchState: fixture, config });
		approveIntegrateGate({ projectRoot, batchId: BATCH_ID });
		const integrate = integrateOrchToBase({ projectRoot });
		assert.equal(integrate.ok, true);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "pending_lane_land");
		assert.equal(
			result.suggestedCommand,
			`spine batch salvage --batch ${BATCH_ID} --lane 1 --integrate`,
		);
		assert.match(result.headline ?? "", /lane work not on main/i);
		assert.ok(!(result.alternatives ?? []).some((entry) => entry.includes("batch complete")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
