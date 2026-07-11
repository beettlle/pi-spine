/**
 * SP-297 — dead detached engine with phase running resumes without manual pause (SP-284 / #7).
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	buildSuggestedCommand,
	shouldNeverSuggestPause,
} from "../../src/batch/diagnosis.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	assessRunningPhaseResumeEligibility,
	validateMultiTaskResume,
} from "../../src/batch/resume-multi-validate.mjs";
import {
	clearBatchEnginePid,
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const DEAD_PID = 999_999_999;
const TASK_ID = "SP-297T";
const BATCH_ID = "20260618T191236";

/**
 * @param {string} projectRoot
 * @param {string} worktreePath
 */
function seedEngineOrphanRunningState(projectRoot, worktreePath) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "running",
				taskFolder: `spine-tasks/${TASK_ID}-orphan`,
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
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_ID],
				lastHeartbeatAt: Date.now() - 30_000,
			},
		],
	});
	state.phase = "running";
	recordBatchEnginePid(state, DEAD_PID);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, BATCH_ID, "batch.resumed", { pendingSegments: 1 });
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: TASK_ID, laneNumber: 1 });
}

test("engine_orphaned diagnosis suggests retry when task id known, attached resume otherwise", () => {
	assert.equal(shouldNeverSuggestPause("engine_orphaned"), true);
	assert.equal(
		buildSuggestedCommand("engine_orphaned", { failedTaskId: TASK_ID }),
		`spine batch retry ${TASK_ID}`,
	);
	assert.equal(buildSuggestedCommand("engine_orphaned", {}), "spine batch resume --attached");
});

test("dead engine with phase running passes validateMultiTaskResume without pause", async () => {
	const projectRoot = await initGitRepo("spine-engine-orphan-resume-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		seedEngineOrphanRunningState(projectRoot, lane.worktreePath);

		const loaded = loadSpineBatchState(projectRoot);
		assert.equal(loaded.raw?.phase, "running");

		const eligibility = assessRunningPhaseResumeEligibility({
			projectRoot,
			state: loaded.raw,
		});
		assert.equal(eligibility.engineConfirmedDead, true);
		assert.equal(eligibility.allowOrphanResume, true);
		assert.equal(eligibility.orphanKind, "engine");

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.orphanResume, true);
		assert.equal(result.engineConfirmedDead, true);
		assert.equal(result.phase, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("running phase with live engine pid rejects resume without force", async () => {
	const projectRoot = await initGitRepo("spine-engine-orphan-live-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		seedEngineOrphanRunningState(projectRoot, lane.worktreePath);

		const loaded = loadSpineBatchState(projectRoot);
		recordBatchEnginePid(loaded.raw, child.pid);
		saveSpineBatchState(projectRoot, loaded.raw);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "cannot_resume");
		assert.match(result.output ?? "", /phase running/i);
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("reconcile engine_orphaned recommends attached resume for batch 20260618T191236 pattern", async () => {
	const projectRoot = await initGitRepo("spine-engine-orphan-reconcile-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		seedEngineOrphanRunningState(projectRoot, lane.worktreePath);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, `spine batch retry ${TASK_ID}`);
		assert.match(result.headline, /engine died/i);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildSuggestedCommand for engine_orphaned + allTasksTerminalSuccess prefers detached resume (#196)", () => {
	assert.equal(
		buildSuggestedCommand("engine_orphaned", { allTasksTerminalSuccess: true }),
		"spine batch resume --force",
	);
	assert.doesNotMatch(
		buildSuggestedCommand("engine_orphaned", { allTasksTerminalSuccess: true }),
		/--attached/,
	);
	assert.equal(
		buildSuggestedCommand("state_drift", {
			failedTaskId: TASK_ID,
			phase: "running",
			staleEnginePid: true,
			allTasksTerminalSuccess: true,
		}),
		"spine batch resume --force",
	);
});

test("dead engine + doneInLane heal + cleared PID allows force resume without attached (#196)", async () => {
	const projectRoot = await initGitRepo("spine-drift-detached-196-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const batchId = "20260711T196613";
		const taskId = "SP-613";
		const taskFolder = `spine-tasks/${taskId}-smoke`;
		const orchBranch = `orch/spine-${batchId}`;
		const taskBranch = laneTaskBranch(batchId, 1);

		fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, taskFolder), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, taskFolder, "PROMPT.md"),
			minimalValidPromptMarkdown(taskId, {
				fileScope: "src/sp613.txt",
				mission: "Drift detached recover regression fixture.",
			}),
			"utf-8",
		);
		fs.writeFileSync(path.join(projectRoot, "src", "sp613.txt"), "seed\n", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "seed"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "orch-marker.txt"), "orch\n", "utf-8");
		execFileSync("git", ["add", "orch-marker.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch advance"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const dest = path.join(lane.worktreePath, taskFolder);
		fs.mkdirSync(dest, { recursive: true });
		fs.cpSync(path.join(projectRoot, taskFolder), dest, { recursive: true });
		fs.mkdirSync(path.join(lane.worktreePath, "src"), { recursive: true });
		fs.writeFileSync(path.join(dest, ".DONE"), "done\n", "utf-8");
		fs.writeFileSync(path.join(lane.worktreePath, "src", "sp613.txt"), "done\n", "utf-8");
		execFileSync("git", ["add", "-A"], { cwd: lane.worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "worker: .DONE"], {
			cwd: lane.worktreePath,
			stdio: "ignore",
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
					taskFolder,
					startedAt: Date.now() - 60_000,
					doneFileFound: false,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: lane.worktreePath,
					branch: taskBranch,
					taskIds: [taskId],
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });
		appendJournalEvent(projectRoot, batchId, "lane.completed", { taskId, laneNumber: 1 });
		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			reviewType: "final",
			verdict: "APPROVE",
		});

		reconcileBatch({ projectRoot, verbose: true });
		const healed = loadSpineBatchState(projectRoot);
		assert.equal(healed.raw?.tasks?.[0]?.status, "succeeded");
		clearBatchEnginePid(healed.raw);
		saveSpineBatchState(projectRoot, healed.raw);

		const eligibility = assessRunningPhaseResumeEligibility({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
		});
		assert.equal(eligibility.engineConfirmedDead, true);
		assert.equal(eligibility.allowOrphanResume, true);
		assert.equal(eligibility.terminalSuccessPendingMerge, true);

		const validated = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(validated.ok, true, validated.output ?? validated.error);
		assert.doesNotMatch(validated.output ?? "", /phase running/i);

		const diagnosis = reconcileBatch({ projectRoot, verbose: true });
		assert.doesNotMatch(diagnosis.suggestedCommand ?? "", /--attached/);

		const { resumeBatch } = await import("../../src/batch/resume.mjs");
		const { loadGateRecord } = await import("../../src/batch/gate.mjs");
		const resumeResult = await resumeBatch({ projectRoot, force: true });
		assert.equal(resumeResult.ok, true, resumeResult.output ?? resumeResult.error);
		const final = loadSpineBatchState(projectRoot).raw;
		assert.ok(
			final?.phase === "completed" || loadGateRecord(projectRoot, batchId) != null,
			`expected gate-ready / completed, got phase=${final?.phase}`,
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
