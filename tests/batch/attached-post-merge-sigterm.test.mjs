/**
 * SP-316 — attached post-merge SIGTERM land loop (batch 20260620T194352, GitHub #21).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	attemptPostMergeLandLoopHandoff,
	finalizeAttachedPostMergeLimbo,
	installAttachedEngineShutdownHandlers,
} from "../../src/batch/attached-engine-handoff.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { isPostMergeLimbo } from "../../src/batch/post-merge-limbo.mjs";
import { resumeMultiTaskBatch } from "../../src/batch/resume-multi.mjs";
import { terminateStaleDetachedEngine } from "../../src/batch/resume-engine.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260620T194352";
const TASK_W0_A = "SP-311";
const TASK_W0_B = "SP-312";
const TASK_W1_A = "SP-313";
const TASK_W1_B = "SP-314";

/**
 * Batch 20260620T194352 shape: four independent tasks, two lanes, two waves.
 *
 * @param {string} projectRoot
 */
function seedBatch20260620T194352PostMergeLimbo(projectRoot) {
	const orchBranch = `orch/spine-${BATCH_ID}`;
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [
			[TASK_W0_A, TASK_W0_B],
			[TASK_W1_A, TASK_W1_B],
		],
		tasks: [
			{
				taskId: TASK_W0_A,
				laneNumber: 1,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W0_A}-sigterm`),
				doneFileFound: true,
			},
			{
				taskId: TASK_W0_B,
				laneNumber: 2,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W0_B}-sigterm`),
				doneFileFound: true,
			},
			{
				taskId: TASK_W1_A,
				laneNumber: 1,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W1_A}-sigterm`),
				doneFileFound: true,
			},
			{
				taskId: TASK_W1_B,
				laneNumber: 2,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W1_B}-sigterm`),
				doneFileFound: true,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: projectRoot,
				branch: `task/spine-lane-1-${BATCH_ID}`,
				taskIds: [TASK_W0_A, TASK_W1_A],
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: projectRoot,
				branch: `task/spine-lane-2-${BATCH_ID}`,
				taskIds: [TASK_W0_B, TASK_W1_B],
			},
		],
	});
	state.phase = "running";
	state.totalWaves = 2;
	state.currentWaveIndex = 1;
	state.mergeResults = [
		{ waveIndex: 0, status: "succeeded", mergeCommit: "c72cc3c52075e54c1dfa183f38043f1ef1a28ce3" },
		{ waveIndex: 1, status: "succeeded", mergeCommit: "aff02cacf6da0ac115bfa35a298b1b1c611cbb19" },
	];
	state.resilience = { enginePid: process.pid };
	saveSpineBatchState(projectRoot, state);
	return { state, orchBranch };
}

/**
 * @param {string} projectRoot
 */
function seedJournalMergeThenOrphan(projectRoot) {
	appendJournalEvent(projectRoot, BATCH_ID, "batch.merge_completed", {
		mergeCommit: "aff02cacf6da0ac115bfa35a298b1b1c611cbb19",
		laneNumber: 1,
		waveIndex: 1,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.merge_completed", {
		mergeCommit: "aff02cacf6da0ac115bfa35a298b1b1c611cbb19",
		laneNumber: 2,
		waveIndex: 1,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "engine.orphan_terminated", {
		stalePid: 13_605,
		fromPhase: "running",
		signal: "SIGTERM",
	});
}

test("batch 20260620T194352 fixture is post-merge limbo without gate", async () => {
	const projectRoot = await initGitRepo("spine-attached-sigterm-fixture-");
	try {
		seedBatch20260620T194352PostMergeLimbo(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(isPostMergeLimbo(state), true);
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("attemptPostMergeLandLoopHandoff finalizes in-process after SIGTERM-shaped limbo", async () => {
	const projectRoot = await initGitRepo("spine-attached-sigterm-finalize-");
	try {
		const { orchBranch } = seedBatch20260620T194352PostMergeLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);

		const handoff = attemptPostMergeLandLoopHandoff({
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
		assert.ok(events.some((event) => event.type === "engine.attached_post_merge_handoff"));
		assert.equal(String(orchBranch).length > 0, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("finalizeAttachedPostMergeLimbo is idempotent when gate already open", async () => {
	const projectRoot = await initGitRepo("spine-attached-sigterm-idempotent-");
	try {
		const { state, orchBranch } = seedBatch20260620T194352PostMergeLimbo(projectRoot);
		const first = finalizeAttachedPostMergeLimbo({
			projectRoot,
			state,
			batchId: BATCH_ID,
			orchBranch,
		});
		assert.ok(first?.ok);

		const second = finalizeAttachedPostMergeLimbo({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId: BATCH_ID,
			orchBranch,
		});
		assert.equal(second, null);
		assert.equal(readJournalEvents(projectRoot, BATCH_ID).filter((e) => e.type === "gate.opened").length, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resume after orphan_terminated journal opens gate for batch 20260620T194352 pattern", async () => {
	const projectRoot = await initGitRepo("spine-attached-sigterm-resume-");
	try {
		seedBatch20260620T194352PostMergeLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);

		const result = await resumeMultiTaskBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "gate.opened"));
		assert.ok(events.some((event) => event.type === "batch.completed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("installAttachedEngineShutdownHandlers finalizes on SIGTERM without manual resume", async () => {
	const projectRoot = await initGitRepo("spine-attached-sigterm-handler-");
	const previousExit = process.exit;
	/** @type {number|undefined} */
	let exitCode;
	process.exit = (code) => {
		exitCode = code;
	};

	try {
		seedBatch20260620T194352PostMergeLimbo(projectRoot);
		installAttachedEngineShutdownHandlers({ projectRoot });
		process.emit("SIGTERM");
		assert.equal(exitCode, 0);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
	} finally {
		process.exit = previousExit;
		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("SIGINT");
		await destroyGitRepo(projectRoot);
	}
});

test("terminateStaleDetachedEngine during post-merge limbo still allows resume finalize", async () => {
	const projectRoot = await initGitRepo("spine-attached-sigterm-stale-");
	const child = await import("node:child_process").then(({ spawn }) =>
		spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]),
	);

	try {
		const { state } = seedBatch20260620T194352PostMergeLimbo(projectRoot);
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);

		const terminated = terminateStaleDetachedEngine({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId: BATCH_ID,
			fromPhase: "running",
		});
		assert.equal(terminated.terminated, true);

		const result = await resumeMultiTaskBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});
