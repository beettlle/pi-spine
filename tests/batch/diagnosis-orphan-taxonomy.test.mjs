import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	DIAGNOSIS_TAXONOMY,
	buildDiagnosisOutput,
	buildHeadline,
	buildSuggestedCommand,
	inferLaunchFailureFromWorkerOutputTail,
} from "../../src/batch/diagnosis.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { workerOutputLogPath } from "../../src/batch/worker-output.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const FIXTURES = path.join(process.cwd(), "tests/fixtures/incidents");

test("DIAGNOSIS_TAXONOMY includes worker_orphaned distinct from needs_retry", () => {
	assert.ok(DIAGNOSIS_TAXONOMY.includes("worker_orphaned"));
	assert.ok(DIAGNOSIS_TAXONOMY.includes("needs_retry"));
	const workerIndex = DIAGNOSIS_TAXONOMY.indexOf("worker_orphaned");
	const retryIndex = DIAGNOSIS_TAXONOMY.indexOf("needs_retry");
	assert.notEqual(workerIndex, retryIndex);
});

test("inferLaunchFailureFromWorkerOutputTail reads PI_SPINE_ROOT hints from log tail", () => {
	assert.equal(
		inferLaunchFailureFromWorkerOutputTail(
			"worker boot failed\nCONFIG_PI_SPINE_ROOT_MISSING: set PI_SPINE_ROOT in devcontainer\n",
		),
		"pi_spine_root",
	);
});

test("buildSuggestedCommand prefers abort for ghost running cluster", () => {
	assert.equal(
		buildSuggestedCommand("worker_orphaned", {
			failedTaskId: "SAT-039",
			ghostRunningCluster: true,
		}),
		"spine batch abort",
	);
});

test("buildHeadline surfaces worker_orphaned launch failure from worker output context", () => {
	const headline = buildHeadline("worker_orphaned", {
		batchId: "20260605T160800",
		failedTaskId: "SAT-048",
		launchFailureKind: "pi_spine_root",
	});
	assert.match(headline, /lane worker orphaned during launch/);
	assert.match(headline, /PI_SPINE_ROOT\/devcontainer/);
});

test("dead lane workerPid diagnoses worker_orphaned not needs_retry", async () => {
	const projectRoot = await initGitRepo("spine-worker-orphan-taxonomy-");
	try {
		const batchId = "20260605T120000";
		const taskId = "SP-115";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${taskId}-orphan`,
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
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: Date.now() - 60_000,
					workerPid: DEAD_PID,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });
		appendJournalEvent(projectRoot, batchId, "lane.heartbeat", { laneNumber: 1, taskId });

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.notEqual(result.diagnosis, "needs_retry");
		assert.equal(result.suggestedCommand, `spine batch retry ${taskId}`);
		assert.match(result.headline, /lane worker orphaned/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("worker_orphaned enriches launch headline from worker output log without task.failed", async () => {
	const projectRoot = await initGitRepo("spine-worker-orphan-launch-log-");
	try {
		const batchId = "20260605T160800";
		const taskId = "SAT-048";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${taskId}-launch`,
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
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: Date.now() - 30_000,
					workerPid: DEAD_PID,
					workerPhase: "launching",
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		const logPath = workerOutputLogPath(projectRoot, batchId, 1, taskId);
		fs.mkdirSync(path.dirname(logPath), { recursive: true });
		fs.writeFileSync(
			logPath,
			"booting worker\nCONFIG_PI_SPINE_ROOT_MISSING: set PI_SPINE_ROOT in devcontainer\n",
			"utf-8",
		);

		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.match(result.headline, /lane worker orphaned during launch/);
		assert.match(result.headline, /PI_SPINE_ROOT\/devcontainer/);
		assert.equal(result.suggestedCommand, "spine doctor");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("multiple ghost running tasks on one lane prefer spine batch abort", async () => {
	const projectRoot = await initGitRepo("spine-worker-orphan-cluster-");
	try {
		const fixture = JSON.parse(
			fs.readFileSync(path.join(FIXTURES, "resume-parallel-lane-orphan.json"), "utf-8"),
		);
		const batchId = fixture.batchState.batchId;
		const lane1 = fixture.batchState.lanes.find((lane) => lane.laneNumber === 1);
		lane1.workerPid = DEAD_PID;
		saveSpineBatchState(projectRoot, fixture.batchState);

		const journalFile = path.join(projectRoot, ".spine", "runtime", batchId, "journal.jsonl");
		fs.mkdirSync(path.dirname(journalFile), { recursive: true });
		for (const event of fixture.journalTail ?? []) {
			fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
		}

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "worker_orphaned");
		assert.equal(result.suggestedCommand, "spine batch abort");
		assert.match(result.headline, /multiple ghost running tasks/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("segment drift still diagnoses needs_retry", async () => {
	const projectRoot = await initGitRepo("spine-worker-orphan-segment-drift-");
	try {
		const batchId = "20260605T130000";
		const taskId = "SP-116";
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
					taskFolder: `spine-tasks/${taskId}-drift`,
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
		state.phase = "running";
		state.segments = [{ segmentId: `${taskId}::default`, taskId, status: "failed" }];
		saveSpineBatchState(projectRoot, state);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "needs_retry");
		assert.notEqual(result.diagnosis, "worker_orphaned");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildDiagnosisOutput bundles worker_orphaned headline and command", () => {
	const output = buildDiagnosisOutput("worker_orphaned", {
		batchId: "20260605T160800",
		failedTaskId: "SAT-048",
		launchFailureKind: "launch_failed",
	});
	assert.match(output.headline, /lane worker orphaned during launch/);
	assert.equal(output.suggestedCommand, "spine doctor");
});
