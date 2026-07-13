import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import {
	assessRunningPhaseResumeEligibility,
	validateMultiTaskResume,
} from "../../src/batch/resume-multi-validate.mjs";
import { validateResumeBatch } from "../../src/batch/resume.mjs";
import {
	clearBatchEnginePid,
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function buildTwoTaskPausedState({ _projectRoot, batchId, orchBranch, worktreePaths }) {
	const taskA = "TP-031";
	const taskB = "TP-032";
	return createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskA, taskB]],
		tasks: [
			{
				taskId: taskA,
				laneNumber: 1,
				status: "running",
				taskFolder: `spine-tasks/${taskA}-smoke`,
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
			{
				taskId: taskB,
				laneNumber: 2,
				status: "running",
				taskFolder: `spine-tasks/${taskB}-smoke`,
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
				worktreePath: worktreePaths[0],
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskA],
				lastHeartbeatAt: null,
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: worktreePaths[1],
				branch: laneTaskBranch(batchId, 2),
				taskIds: [taskB],
				lastHeartbeatAt: null,
			},
		],
	});
}

test("validateMultiTaskResume accepts paused 2-task 2-lane batch", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-ok-");
	try {
		const batchId = "20260602T181027";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = buildTwoTaskPausedState({
			projectRoot,
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, lane2.worktreePath],
		});
		state.phase = "paused";
		state.currentWaveIndex = 0;
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.batchId, batchId);
		assert.equal(result.pendingTasks.length, 2);
		assert.equal(result.lanes.length, 2);
		assert.equal(result.resumableWave, 0);
		assert.deepEqual(
			result.pendingTasks.map((task) => task.taskId).sort(),
			["TP-031", "TP-032"],
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume rejects batch with zero tasks", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-notasks-");
	try {
		const batchId = "20260602T181028";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[]],
			tasks: [],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: [],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "no_tasks_or_lanes");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume rejects missing worktree per lane", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-wtmiss-");
	try {
		const batchId = "20260602T181029";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const missingLane2Path = laneWorktreePath(projectRoot, batchId, 2);

		const state = buildTwoTaskPausedState({
			projectRoot,
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, missingLane2Path],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "worktree_missing");
		assert.equal(result.laneNumber, 2);
		assert.match(result.output ?? "", /lane-2/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume allows force resume when wave merge is pending", async () => {
	const projectRoot = await initGitRepo("spine-resume-force-merge-");
	try {
		const batchId = "20260618T235804";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["TP-268", "TP-299"]],
			tasks: [
				{
					taskId: "TP-268",
					laneNumber: 1,
					status: "skipped",
					taskFolder: "spine-tasks/TP-268-smoke",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: false,
					exitReason: "skipped",
				},
				{
					taskId: "TP-299",
					laneNumber: 2,
					status: "succeeded",
					taskFolder: "spine-tasks/TP-299-smoke",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: lane1.worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["TP-268"],
					lastHeartbeatAt: null,
				},
				{
					laneNumber: 2,
					laneId: "lane-2",
					worktreePath: lane2.worktreePath,
					branch: laneTaskBranch(batchId, 2),
					taskIds: ["TP-299"],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "failed";
		state.mergeResults = [];
		state.segments = [
			{ segmentId: "TP-268::default", taskId: "TP-268", status: "skipped", repoId: "default" },
			{ segmentId: "TP-299::default", taskId: "TP-299", status: "succeeded", repoId: "default" },
		];
		state.resilience = { forceMergedWaves: [0] };
		saveSpineBatchState(projectRoot, state);

		const blocked = validateMultiTaskResume({ projectRoot, force: false });
		assert.equal(blocked.ok, false);
		assert.match(blocked.output ?? "", /--force/);

		const result = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.pendingTasks.length, 0);
		assert.equal(result.resumableWave, 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateResumeBatch delegates to multi validator for single-task batch", async () => {
	const projectRoot = await initGitRepo("spine-resume-delegate-");
	try {
		const batchId = "20260602T181030";
		const taskId = "TP-999";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: path.join("spine-tasks", `${taskId}-smoke`),
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
					worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateResumeBatch({ projectRoot });
		assert.equal(result.ok, true);
		assert.equal(result.taskId, taskId);
		assert.equal(result.pendingTasks.length, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("pidless running + terminal-success classification allows force resume without pause (#197)", async () => {
	const projectRoot = await initGitRepo("spine-resume-197-terminal-class-");
	try {
		const batchId = "20260712T197635";
		const taskId = "SP-635";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					classification: "terminal-success",
					doneInLane: true,
					taskFolder: path.join("spine-tasks", `${taskId}-smoke`),
					startedAt: Date.now() - 60_000,
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: lane.worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [];
		clearBatchEnginePid(state);
		saveSpineBatchState(projectRoot, state);

		const eligibility = assessRunningPhaseResumeEligibility({ projectRoot, state });
		assert.equal(eligibility.engineConfirmedDead, true);
		assert.equal(eligibility.allowOrphanResume, true);
		assert.equal(eligibility.terminalSuccessPendingMerge, true);

		const rejectedWithoutForce = validateMultiTaskResume({ projectRoot, force: false });
		// Force is still required for the agent-safe path; without it, orphan may or may not
		// admit — assert force path is what diagnose suggests (#197).
		const forced = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(forced.ok, true, forced.output ?? forced.error);
		assert.equal(forced.engineConfirmedDead, true);
		assert.doesNotMatch(forced.output ?? "", /phase running/i);
		assert.ok(
			rejectedWithoutForce.ok === true || rejectedWithoutForce.error === "cannot_resume",
			"non-force result must be ok or cannot_resume",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("pidless running without terminal signals rejects terminal-success shortcut", async () => {
	const projectRoot = await initGitRepo("spine-resume-197-fail-closed-");
	try {
		const batchId = "20260712T197636";
		const taskId = "SP-635B";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: path.join("spine-tasks", `${taskId}-smoke`),
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
					worktreePath: lane.worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "running";
		clearBatchEnginePid(state);
		saveSpineBatchState(projectRoot, state);

		const eligibility = assessRunningPhaseResumeEligibility({ projectRoot, state });
		assert.equal(eligibility.terminalSuccessPendingMerge, false);
		// Without dead-PID orphan journal signals, force resume must still fail closed.
		assert.equal(eligibility.engineConfirmedDead, false);
		const forced = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(forced.ok, false);
		assert.equal(forced.error, "cannot_resume");
		assert.match(forced.output ?? "", /phase running/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
