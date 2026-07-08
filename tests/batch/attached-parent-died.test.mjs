/**
 * SP-539 — attached parent-session guard (FR-STAB-01, GitHub #163).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runSpineBatch } from "../../bin/spine-batch.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	isParentSessionLost,
	reconcileParentSessionLost,
	startParentSessionMonitor,
} from "../../src/batch/parent-session-monitor.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	readBatchEnginePid,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { enforceAttachedOrphanRiskGuard } from "../../src/doctor/attached-orphan-risk.mjs";
import { laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260708T120000";
const TASK_ID = "SP-539";
const DEAD_PID = 999_999_998;

test("isParentSessionLost detects reparented and dead parent PIDs", () => {
	assert.equal(
		isParentSessionLost({
			initialParentPid: 42,
			currentParentPid: 42,
			isAlive: () => true,
		}),
		false,
	);
	assert.equal(
		isParentSessionLost({
			initialParentPid: 42,
			currentParentPid: 1,
			isAlive: () => true,
		}),
		true,
	);
	assert.equal(
		isParentSessionLost({
			initialParentPid: 42,
			currentParentPid: 42,
			isAlive: () => false,
		}),
		true,
	);
});

test("reconcileParentSessionLost journals engine.parent_died and pauses batch", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "sp539-reconcile-"));
	try {
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
					taskFolder: `spine-tasks/${TASK_ID}-parent-died`,
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
					worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
					branch: `task/spine-${BATCH_ID}-lane-1`,
					taskIds: [TASK_ID],
					workerPid: DEAD_PID,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);

		const result = reconcileParentSessionLost({
			projectRoot,
			parentPid: 4242,
			enginePid: process.pid,
		});

		assert.equal(result.handled, true);
		assert.deepEqual(result.taskIds, [TASK_ID]);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		const parentDied = events.find((event) => event.type === "engine.parent_died");
		assert.ok(parentDied, "expected engine.parent_died journal event");
		assert.equal(parentDied.payload?.parentPid, 4242);
		assert.equal(parentDied.payload?.enginePid, process.pid);
		assert.equal(parentDied.payload?.signal, "parent_exit");

		const { raw } = loadSpineBatchState(projectRoot);
		assert.equal(raw?.phase, "paused");
		assert.equal(readBatchEnginePid(raw), null);
		const task = raw?.tasks?.find((entry) => entry.taskId === TASK_ID);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "parent_exit");
		assert.equal(raw?.lanes?.[0]?.workerPid, undefined);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("startParentSessionMonitor reconciles when parent PID changes", async () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "sp539-monitor-"));
	try {
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
					taskFolder: `spine-tasks/${TASK_ID}-parent-died`,
					startedAt: Date.now() - 60_000,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
					branch: `task/spine-${BATCH_ID}-lane-1`,
					taskIds: [TASK_ID],
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);

		let currentParentPid = 1001;
		const monitor = await startParentSessionMonitor({
			projectRoot,
			pollIntervalMs: 20,
			readParentPid: () => currentParentPid,
			isAlive: () => true,
		});

		currentParentPid = 1;
		await new Promise((resolve) => setTimeout(resolve, 80));
		await monitor.stop();

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "engine.parent_died"));
		const { raw } = loadSpineBatchState(projectRoot);
		assert.equal(raw?.phase, "paused");
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("enforceAttachedOrphanRiskGuard blocks risky attached contexts", () => {
	const blocked = enforceAttachedOrphanRiskGuard({
		stdinIsTTY: false,
		env: { SPINE_IS_WORKER: "1" },
	});
	assert.equal(blocked.ok, false);
	assert.equal(blocked.error, "attached_orphan_risk");
	assert.match(blocked.output ?? "", /omit --attached/);
	assert.match(blocked.output ?? "", /spine wait/);

	const allowed = enforceAttachedOrphanRiskGuard({
		stdinIsTTY: true,
		env: {},
	});
	assert.equal(allowed.ok, true);
});

test("runSpineBatch attached start fails fast in worker harness context", async () => {
	const projectRoot = await initGitRepo("sp539-attached-guard-");
	const prevWorker = process.env.SPINE_IS_WORKER;
	const prevHarness = process.env.SPINE_ALLOW_ATTACHED_HARNESS;
	process.env.SPINE_IS_WORKER = "1";
	delete process.env.SPINE_ALLOW_ATTACHED_HARNESS;

	try {
		const cli = await runSpineBatch({
			projectRoot,
			args: ["start", "pending", "--attached", "--skip-preflight"],
			deferAttachedExit: true,
		});

		assert.equal(cli.exitCode, 1);
		assert.match(cli.output ?? "", /Refusing batch --attached/);
		assert.match(cli.output ?? "", /SPINE_IS_WORKER/);
		assert.match(cli.output ?? "", /spine wait/);
	} finally {
		if (prevWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prevWorker;
		if (prevHarness === undefined) delete process.env.SPINE_ALLOW_ATTACHED_HARNESS;
		else process.env.SPINE_ALLOW_ATTACHED_HARNESS = prevHarness;
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineBatch attached resume fails fast for non-interactive stdin", async () => {
	const projectRoot = await initGitRepo("sp539-attached-resume-guard-");
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "failed",
				taskFolder: `spine-tasks/${TASK_ID}-parent-died`,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
				branch: `task/spine-${BATCH_ID}-lane-1`,
				taskIds: [TASK_ID],
			},
		],
	});
	state.phase = "failed";
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, BATCH_ID, "batch.failed", { reason: "test_fixture" });

	const prevStdinIsTTY = process.stdin.isTTY;
	const prevHarness = process.env.SPINE_ALLOW_ATTACHED_HARNESS;
	delete process.env.SPINE_ALLOW_ATTACHED_HARNESS;
	Object.defineProperty(process.stdin, "isTTY", {
		configurable: true,
		value: false,
	});

	try {
		const cli = await runSpineBatch({
			projectRoot,
			args: ["resume", "--attached", "--skip-preflight"],
			deferAttachedExit: true,
		});

		assert.equal(cli.exitCode, 1);
		assert.match(cli.output ?? "", /stdin is not a TTY/);
	} finally {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: prevStdinIsTTY,
		});
		if (prevHarness === undefined) delete process.env.SPINE_ALLOW_ATTACHED_HARNESS;
		else process.env.SPINE_ALLOW_ATTACHED_HARNESS = prevHarness;
		await destroyGitRepo(projectRoot);
	}
});
