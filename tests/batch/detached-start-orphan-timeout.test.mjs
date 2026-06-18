import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startBatchDetached } from "../../src/batch/detached-start.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;

test("timeout_waiting_for_batch with dead enginePid reconciles as engine_orphaned not running", async () => {
	const projectRoot = await initGitRepo("spine-detached-start-orphan-timeout-");
	try {
		const batchId = "20260605T191325";
		const taskId = "SP-117";
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
					taskFolder: `spine-tasks/${taskId}-symmetry`,
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
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "batch.started", { scope: [taskId] });
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, "spine batch resume --attached");
		assert.match(result.headline, /engine died/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatchDetached persists spawn enginePid before wait on timeout failure path", async () => {
	const projectRoot = await initGitRepo("spine-detached-start-persist-fail-");
	try {
		const batchId = "20260605T120001";
		const taskId = "SP-117";
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
					taskFolder: `spine-tasks/${taskId}-symmetry`,
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
				},
			],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const fakeSpine = path.join(projectRoot, "fake-spine.mjs");
		fs.writeFileSync(fakeSpine, "setTimeout(() => process.exit(0), 50);\n", "utf-8");

		const result = await startBatchDetached({
			projectRoot,
			spineBin: fakeSpine,
			scope: taskId,
			skipPreflight: true,
			waitTerminal: true,
			json: true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.result?.error, "timeout_waiting_for_batch");

		const { raw } = loadSpineBatchState(projectRoot);
		const enginePid = raw?.resilience?.enginePid;
		assert.ok(Number.isFinite(enginePid) && enginePid > 0, "parent should persist spawn pid before wait");
		assert.equal(isProcessAlive(enginePid), false, "spawned engine should have exited");

		const reconcile = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(reconcile.diagnosis, "running");
		assert.equal(reconcile.diagnosis, "engine_orphaned");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
