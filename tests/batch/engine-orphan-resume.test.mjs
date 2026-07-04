/**
 * SP-297 — dead detached engine with phase running resumes without manual pause (SP-284 / #7).
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
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
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

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
