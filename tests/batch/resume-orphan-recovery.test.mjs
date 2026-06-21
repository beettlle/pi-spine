/**
 * SP-309 — batch resume orphan recovery (issue #13 / batch 20260619T020951).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	resolveDetachedWaitTimeoutMs,
} from "../../src/batch/detached-start.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	clearStaleLaneWorkerPids,
	prepareOrphanResumeHandoff,
} from "../../src/batch/resume-engine.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const BATCH_ID = "20260619T020951";
const TASK_DONE = "SP-300";
const TASK_STUCK = "SP-306";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-orphan-recovery`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: `src/${taskId.toLowerCase()}.txt`,
			mission: "Resume orphan recovery regression fixture.",
		}),
		"utf-8",
	);
}

/**
 * Batch 20260619T020951 shape after plan review failure and resume stall.
 *
 * @param {string} projectRoot
 * @param {string} lane2Path
 */
function seedWorkerOrphanAfterPlanReview(projectRoot, lane2Path) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_DONE, TASK_STUCK]],
		tasks: [
			{
				taskId: TASK_DONE,
				laneNumber: 1,
				status: "succeeded",
				taskFolder: `spine-tasks/${TASK_DONE}-orphan-recovery`,
				doneFileFound: true,
				endedAt: Date.now() - 60_000,
			},
			{
				taskId: TASK_STUCK,
				laneNumber: 2,
				status: "running",
				taskFolder: `spine-tasks/${TASK_STUCK}-orphan-recovery`,
				startedAt: Date.now() - 30_000,
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_DONE],
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: lane2Path,
				branch: laneTaskBranch(BATCH_ID, 2),
				taskIds: [TASK_STUCK],
				lastHeartbeatAt: Date.now() - 60_000,
				workerPid: DEAD_PID,
			},
		],
	});
	state.phase = "running";
	state.succeededTasks = 1;
	recordBatchEnginePid(state, DEAD_PID);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, BATCH_ID, "review.failed", {
		taskId: TASK_STUCK,
		reviewType: "plan",
		reason: "nested_spawn_blocked",
		stepNumber: 0,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.resumed", {
		resumeForced: true,
		pendingTaskIds: [TASK_STUCK],
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
		taskId: TASK_STUCK,
		laneNumber: 2,
		resumed: true,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "worker.rules_selected", {
		taskId: TASK_STUCK,
		laneNumber: 2,
	});
}

test("resolveDetachedWaitTimeoutMs uses long default for wait-terminal orphan resume", () => {
	assert.equal(resolveDetachedWaitTimeoutMs(false), 30_000);
	assert.equal(resolveDetachedWaitTimeoutMs(true), 2 * 60 * 60 * 1000);
	assert.equal(resolveDetachedWaitTimeoutMs(true, 120_000), 120_000);
});

test("prepareOrphanResumeHandoff clears stale workerPid before orphan resume", async () => {
	const projectRoot = await initGitRepo("spine-orphan-handoff-");
	try {
		const state = createInitialBatchState({
			batchId: BATCH_ID,
			baseBranch: "main",
			orchBranch: `orch/spine-${BATCH_ID}`,
			wavePlan: [[TASK_STUCK]],
			tasks: [{ taskId: TASK_STUCK, laneNumber: 1, status: "running" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", workerPid: DEAD_PID }],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);

		prepareOrphanResumeHandoff({
			projectRoot,
			state,
			batchId: BATCH_ID,
			fromPhase: "running",
			orphanResume: true,
			engineConfirmedDead: true,
		});

		assert.equal(state.lanes[0].workerPid, undefined);
		assert.equal(state.resilience?.enginePid, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("clearStaleLaneWorkerPids preserves live worker pid", async () => {
	const projectRoot = await initGitRepo("spine-clear-stale-worker-");
	const child = await import("node:child_process").then(({ spawn }) =>
		spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]),
	);
	try {
		const state = createInitialBatchState({
			batchId: "test",
			baseBranch: "main",
			orchBranch: "orch/test",
			wavePlan: [["T"]],
			tasks: [],
			lanes: [
				{ laneNumber: 1, laneId: "lane-1", workerPid: DEAD_PID },
				{ laneNumber: 2, laneId: "lane-2", workerPid: child.pid },
			],
		});
		clearStaleLaneWorkerPids(state);
		assert.equal(state.lanes[0].workerPid, undefined);
		assert.equal(state.lanes[1].workerPid, child.pid);
	} finally {
		child.kill("SIGKILL");
		await destroyGitRepo(projectRoot);
	}
});

test("dual-dead lane+engine orphan reconciles as engine_orphaned with attached resume", async () => {
	const projectRoot = await initGitRepo("spine-dual-dead-reconcile-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });
		seedWorkerOrphanAfterPlanReview(projectRoot, lane2.worktreePath);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, `spine batch retry ${TASK_STUCK}`);
		assert.match(result.headline, /engine died/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("attached resume --force completes stuck task after plan review orphan stall", async () => {
	const projectRoot = await initGitRepo("spine-resume-orphan-recovery-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, TASK_DONE);
		writeSmokeTask(projectRoot, TASK_STUCK);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [TASK_DONE]: [], [TASK_STUCK]: [] } }, null, 2),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add orphan recovery tasks"], { cwd: projectRoot, stdio: "ignore" });

		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const lane1 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });

		for (const [taskId, lane] of [
			[TASK_DONE, lane1],
			[TASK_STUCK, lane2],
		]) {
			const src = path.join(projectRoot, "spine-tasks", `${taskId}-orphan-recovery`);
			const dest = path.join(lane.worktreePath, "spine-tasks", `${taskId}-orphan-recovery`);
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.cpSync(src, dest, { recursive: true });
		}

		seedWorkerOrphanAfterPlanReview(projectRoot, lane2.worktreePath);

		const resumeResult = await resumeBatch({ projectRoot, force: true });
		assert.equal(resumeResult.ok, true, resumeResult.output ?? resumeResult.error);

		const final = loadSpineBatchState(projectRoot).raw;
		const stuck = final?.tasks?.find((task) => task.taskId === TASK_STUCK);
		assert.equal(stuck?.status, "succeeded", JSON.stringify(final?.tasks));
		assert.ok(
			final?.phase === "completed" || final?.phase === "running",
			`unexpected phase ${final?.phase}`,
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("detached resume with wait-terminal uses extended timeout constant", () => {
	assert.ok(resolveDetachedWaitTimeoutMs(true) > 30_000);
});
