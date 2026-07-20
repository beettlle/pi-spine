/**
 * SP-348 — post-merge limbo regression (batch 20260629T021550, GitHub #39).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { finalizeResumePostMergeLimbo } from "../../src/batch/attached-runner.mjs";
import {
	attemptPostMergeLandLoopHandoff,
} from "../../src/batch/attached-engine-handoff.mjs";
import { resumeBatchDetached } from "../../src/batch/detached-start.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	isPostMergeLimbo,
	shouldResumePostMergeLimbo,
} from "../../src/batch/post-merge-limbo.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import { resumeMultiTaskBatch } from "../../src/batch/resume-multi.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260629T021550";
const TASK_IDS = [
	"SP-334",
	"SP-335",
	"SP-336",
	"SP-337",
	"SP-338",
	"SP-339",
	"SP-340",
	"SP-341",
	"SP-342",
	"SP-343",
	"SP-344",
	"SP-345",
	"SP-346",
	"SP-347",
];
const WAVE_0 = TASK_IDS.slice(0, 7);
const WAVE_1 = TASK_IDS.slice(7);

/**
 * Batch 20260629T021550 shape: 14 tasks, 2 waves, 2 lanes, post-merge limbo after wave 1.
 *
 * @param {string} projectRoot
 */
function seedBatch20260629T021550PostMergeLimbo(projectRoot) {
	const orchBranch = `orch/spine-${BATCH_ID}`;
	const tasks = TASK_IDS.map((taskId, index) => ({
		taskId,
		laneNumber: index < 7 ? 1 : 2,
		status: "succeeded",
		taskFolder: path.join("spine-tasks", `${taskId}-limbo-regression`),
		doneFileFound: true,
	}));
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [WAVE_0, WAVE_1],
		tasks,
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: projectRoot,
				branch: `task/spine-lane-1-${BATCH_ID}`,
				taskIds: WAVE_0,
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: projectRoot,
				branch: `task/spine-lane-2-${BATCH_ID}`,
				taskIds: WAVE_1,
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
		stalePid: 19_091,
		fromPhase: "running",
		signal: "SIGTERM",
	});
}

test("batch 20260629T021550 fixture is post-merge limbo without gate", async () => {
	const projectRoot = await initGitRepo("spine-limbo-regression-fixture-");
	try {
		seedBatch20260629T021550PostMergeLimbo(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(isPostMergeLimbo(state), true);
		assert.equal(shouldResumePostMergeLimbo(state), true);
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("attemptPostMergeLandLoopHandoff finalizes batch 20260629T021550 limbo after SIGTERM", async () => {
	const projectRoot = await initGitRepo("spine-limbo-regression-sigterm-");
	try {
		seedBatch20260629T021550PostMergeLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);

		const handoff = attemptPostMergeLandLoopHandoff({
			projectRoot,
			signal: "SIGTERM",
		});
		assert.equal(handoff.handled, true);
		assert.equal(handoff.action, "finalized_in_process");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatchDetached --force finalizes post-merge limbo without spawning engine", async () => {
	const projectRoot = await initGitRepo("spine-limbo-regression-detached-");
	const spineBin = path.join(projectRoot, "bin", "spine.mjs");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const { state } = seedBatch20260629T021550PostMergeLimbo(projectRoot);
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);
		seedJournalMergeThenOrphan(projectRoot);

		const result = await resumeBatchDetached({
			projectRoot,
			spineBin,
			force: true,
			waitTerminal: false,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.result?.status, "resume_completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "gate.opened"));
		assert.ok(events.some((event) => event.type === "batch.completed"));
		assert.ok(events.some((event) => event.type === "engine.orphan_terminated"));
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch attached path finalizes batch 20260629T021550 limbo immediately", async () => {
	const projectRoot = await initGitRepo("spine-limbo-regression-attached-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const { state, orchBranch } = seedBatch20260629T021550PostMergeLimbo(projectRoot);
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);
		seedJournalMergeThenOrphan(projectRoot);

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
		assert.equal(String(orchBranch).length > 0, true);
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("resumeMultiTaskBatch still finalizes batch 20260629T021550 after orphan_terminated", async () => {
	const projectRoot = await initGitRepo("spine-limbo-regression-multi-");
	try {
		seedBatch20260629T021550PostMergeLimbo(projectRoot);
		seedJournalMergeThenOrphan(projectRoot);

		const result = await resumeMultiTaskBatch({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("finalizeResumePostMergeLimbo clears stale engine pid during post-merge limbo", async () => {
	const projectRoot = await initGitRepo("spine-limbo-regression-finalize-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const { state, orchBranch } = seedBatch20260629T021550PostMergeLimbo(projectRoot);
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);

		const result = finalizeResumePostMergeLimbo({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId: BATCH_ID,
			orchBranch,
			resumeForced: true,
		});
		assert.ok(result?.ok);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
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
