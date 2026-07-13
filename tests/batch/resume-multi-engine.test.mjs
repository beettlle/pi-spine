import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { saveGateRecord } from "../../src/batch/gate.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	ensureLandLoopFinalizedAfterGateOrIntegrate,
	finalizeAttachedLandLoopBeforeExit,
	finalizeBatchForIntegrate,
} from "../../src/batch/post-merge-limbo.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId),
		"utf-8",
	);
	return folder;
}

function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

function buildTwoTaskPausedState({ batchId, orchBranch, worktreePaths }) {
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

test("resumeBatch continues paused 2-task 2-lane batch with stub workers", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-engine-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, "TP-031");
		writeSmokeTask(projectRoot, "TP-032");
		writeDependencies(projectRoot, { "TP-031": [], "TP-032": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add smoke tasks"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260602T181027";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });

		const state = buildTwoTaskPausedState({
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, lane2.worktreePath],
		});
		state.phase = "paused";
		state.currentWaveIndex = 0;
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.notEqual(result.error, "single_lane_required");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.succeededTasks, 2);

		const events = readJournalEvents(projectRoot, batchId);
		const resumed = events.find((event) => event.type === "batch.resumed");
		assert.ok(resumed, "journal should contain batch.resumed");
		assert.ok(resumed.payload?.pendingSegments != null);
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === "TP-031"));
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === "TP-032"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch multi path requires existing lane worktrees", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-wt-");
	try {
		const batchId = "20260602T181028";
		const orchBranch = `orch/spine-${batchId}`;
		const state = buildTwoTaskPausedState({
			batchId,
			orchBranch,
			worktreePaths: [
				laneWorktreePath(projectRoot, batchId, 1),
				laneWorktreePath(projectRoot, batchId, 2),
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "worktree_missing");
		assert.notEqual(result.error, "single_lane_required");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("SP-636: ensureLandLoopFinalizedAfterGateOrIntegrate clears PID and emits land_loop_finalized after gate", async () => {
	const projectRoot = await initGitRepo("spine-sp636-ensure-gate-");
	try {
		const batchId = "20260712T212805";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "merged", "utf-8");
		execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["SP-630"]],
			tasks: [
				{
					taskId: "SP-630",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-630-smoke",
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["SP-630"],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }];
		state.resilience = { enginePid: process.pid, resumeForced: true };
		saveSpineBatchState(projectRoot, state);

		saveGateRecord(projectRoot, {
			gateId: "gate-sp636",
			batchId,
			kind: "integrate",
			category: "standard",
			status: "pending",
			openedAt: new Date().toISOString(),
			targetRevision: "abc123",
			evidenceRefs: [],
			summary: "pending",
		});

		const ensured = ensureLandLoopFinalizedAfterGateOrIntegrate({
			projectRoot,
			state,
			batchId,
			resumed: true,
			resumeForced: true,
			source: "resume_fast_path",
		});
		assert.equal(ensured?.ok, true);
		assert.equal(ensured?.changed, true);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.resilience?.enginePid, undefined);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.completed"));
		assert.ok(events.some((event) => event.type === "batch.land_loop_finalized"));

		const again = ensureLandLoopFinalizedAfterGateOrIntegrate({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId,
			resumed: true,
			resumeForced: true,
		});
		assert.equal(again?.changed, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("SP-636: finalizeBatchForIntegrate persists completed after prior land_loop_finalized", async () => {
	const projectRoot = await initGitRepo("spine-sp636-repersist-");
	try {
		const batchId = "20260712T212809";
		const orchBranch = `orch/spine-${batchId}`;
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["SP-630"]],
			tasks: [
				{
					taskId: "SP-630",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-630-smoke",
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["SP-630"],
				},
			],
		});
		state.phase = "completed";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "ccc333" }];
		saveSpineBatchState(projectRoot, state);
		saveGateRecord(projectRoot, {
			gateId: "gate-prior-finalize",
			batchId,
			kind: "integrate",
			category: "standard",
			status: "pending",
			openedAt: new Date().toISOString(),
			targetRevision: "ccc333",
			evidenceRefs: [],
			summary: "pending",
		});
		appendJournalEvent(projectRoot, batchId, "batch.completed", { resumed: false });
		appendJournalEvent(projectRoot, batchId, "batch.land_loop_finalized", {
			source: "engine_land_loop",
		});

		// Simulate pause → resume leaving phase running while prior finalize journal remains.
		state.phase = "running";
		state.endedAt = null;
		state.resilience = { enginePid: process.pid };
		saveSpineBatchState(projectRoot, state);

		const result = finalizeBatchForIntegrate({
			projectRoot,
			state,
			batchId,
			orchBranch,
			resumed: true,
			resumeForced: true,
		});
		assert.equal(result.ok, true);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.resilience?.enginePid, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("SP-636: finalizeAttachedLandLoopBeforeExit finalizes when gate exists without land_loop_finalized", async () => {
	const projectRoot = await initGitRepo("spine-sp636-exit-gate-");
	try {
		const batchId = "20260712T212806";
		const orchBranch = `orch/spine-${batchId}`;
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["SP-630"]],
			tasks: [
				{
					taskId: "SP-630",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-630-smoke",
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["SP-630"],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "def456" }];
		state.resilience = { enginePid: process.pid };
		saveSpineBatchState(projectRoot, state);
		saveGateRecord(projectRoot, {
			gateId: "gate-sp636-exit",
			batchId,
			kind: "integrate",
			category: "standard",
			status: "pending",
			openedAt: new Date().toISOString(),
			targetRevision: "def456",
			evidenceRefs: [],
			summary: "pending",
		});

		const handoff = finalizeAttachedLandLoopBeforeExit({
			projectRoot,
			signal: "SIGTERM",
		});
		assert.equal(handoff.handled, true);
		assert.equal(handoff.action, "finalized_after_gate_or_integrate");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.resilience?.enginePid, undefined);
		assert.ok(
			readJournalEvents(projectRoot, batchId).some(
				(event) => event.type === "batch.land_loop_finalized",
			),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
