/**
 * SP-377 / SP-378 — post-merge limbo regression (batch 20260630T212050, GitHub #59).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rm } from "node:fs/promises";
import test from "node:test";
import { installAttachedExitFinalizeHandlers } from "../../src/batch/attached-runner.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	finalizeAttachedLandLoopBeforeExit,
	hydrateMergeResultsFromJournal,
	isPostMergeLimbo,
} from "../../src/batch/post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "../../src/batch/resume-multi-validate.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260630T212050";
const TASK_IDS = ["SP-344", "SP-351", "SP-353", "SP-356", "SP-363"];
const LANE_1 = [TASK_IDS[0], TASK_IDS[1]];
const LANE_2 = [TASK_IDS[2]];
const LANE_3 = [TASK_IDS[3], TASK_IDS[4]];

/**
 * Batch 20260630T212050 shape: five tasks, three lanes, journal merge before state mergeResults.
 *
 * @param {string} projectRoot
 */
function seedBatch20260630T212050JournalLimbo(projectRoot) {
	const orchBranch = `orch/spine-${BATCH_ID}`;
	const tasks = TASK_IDS.map((taskId, index) => ({
		taskId,
		laneNumber: index < 2 ? 1 : index === 2 ? 2 : 3,
		status: "succeeded",
		taskFolder: path.join("spine-tasks", `${taskId}-limbo-20260630`),
		doneFileFound: true,
	}));
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [TASK_IDS],
		tasks,
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: projectRoot,
				branch: `task/spine-lane-1-${BATCH_ID}`,
				taskIds: LANE_1,
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: projectRoot,
				branch: `task/spine-lane-2-${BATCH_ID}`,
				taskIds: LANE_2,
			},
			{
				laneNumber: 3,
				laneId: "lane-3",
				worktreePath: projectRoot,
				branch: `task/spine-lane-3-${BATCH_ID}`,
				taskIds: LANE_3,
			},
		],
	});
	state.phase = "running";
	state.totalWaves = 1;
	state.currentWaveIndex = 0;
	state.mergeResults = [];
	state.resilience = { enginePid: process.pid };
	saveSpineBatchState(projectRoot, state);
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "--allow-empty", "-m", "orch head"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
	return { state, orchBranch };
}

/**
 * @param {string} projectRoot
 */
function seedJournalMergeThenOrphan(projectRoot) {
	const mergeCommit = "aff02cacf6da0ac115bfa35a298b1b1c611cbb19";
	for (const laneNumber of [1, 2, 3]) {
		appendJournalEvent(projectRoot, BATCH_ID, "batch.merge_completed", {
			mergeCommit,
			laneNumber,
			waveIndex: 0,
		});
	}
	appendJournalEvent(projectRoot, BATCH_ID, "engine.orphan_terminated", {
		stalePid: 16_530,
		fromPhase: "running",
		signal: "SIGTERM",
	});
}

test("batch 20260630T212050 journal fixture is limbo via resume detect but not bare state", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-fixture-");
	try {
		seedBatch20260630T212050JournalLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(isPostMergeLimbo(state), false);
		assert.equal(detectPostMergeLimboForResume({ projectRoot, state }), true);
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("hydrateMergeResultsFromJournal enables state limbo detection for batch 20260630T212050", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-hydrate-");
	try {
		seedBatch20260630T212050JournalLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(hydrateMergeResultsFromJournal({ projectRoot, state, batchId: BATCH_ID }), true);
		assert.equal(isPostMergeLimbo(state), true);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("finalizeAttachedLandLoopBeforeExit opens gate for batch 20260630T212050 journal limbo", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-finalize-");
	try {
		seedBatch20260630T212050JournalLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);

		const handoff = finalizeAttachedLandLoopBeforeExit({
			projectRoot,
			signal: "SIGTERM",
		});
		assert.equal(handoff.handled, true);
		assert.equal(handoff.action, "finalized_in_process");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));

		const events = readJournalEvents(projectRoot, BATCH_ID);
		const mergeIndex = events.findLastIndex((event) => event.type === "batch.merge_completed");
		const handoffIndex = events.findIndex((event) => event.type === "engine.attached_post_merge_handoff");
		const gateIndex = events.findIndex((event) => event.type === "gate.opened");
		assert.ok(handoffIndex > mergeIndex);
		assert.ok(gateIndex > mergeIndex);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("installAttachedExitFinalizeHandlers finalizes journal limbo on SIGTERM without manual resume", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-handler-");
	const previousExit = process.exit;
	/** @type {number|undefined} */
	let exitCode;
	process.exit = (code) => {
		exitCode = code;
	};

	try {
		seedBatch20260630T212050JournalLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);
		installAttachedExitFinalizeHandlers({ projectRoot });
		process.emit("SIGTERM");
		assert.equal(exitCode, 0);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
	} finally {
		process.exit = previousExit;
		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("SIGINT");
		await rm(projectRoot, { recursive: true, force: true });
	}
});
