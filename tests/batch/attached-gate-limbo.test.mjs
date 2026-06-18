/**
 * SP-281 — attached multi-wave batch opens integrate gate after last merge (batch 20260618T000943).
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rm } from "node:fs/promises";
import test from "node:test";
import { startBatch } from "../../src/batch/engine.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	isLastWaveIndex,
	isPostMergeLimbo,
	maybeFinalizeAfterWaveMerge,
} from "../../src/batch/post-merge-limbo.mjs";
import { resumeMultiTaskBatch } from "../../src/batch/resume-multi.mjs";
import { terminateStaleDetachedEngine } from "../../src/batch/resume-engine.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_W0_A = "SP-278";
const TASK_W0_B = "SP-280";
const TASK_W1 = "SP-279";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} fileScopePath
 */
function writeSmokeTask(projectRoot, taskId, fileScopePath) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-gate-limbo`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: fileScopePath,
			mission: "Attached gate limbo regression fixture.",
		}),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeMultiWaveDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_W0_A]: [],
					[TASK_W0_B]: [],
					[TASK_W1]: [TASK_W0_A],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {number} maxParallel
 */
function setMaxParallel(projectRoot, maxParallel) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.lanes = { ...config.lanes, maxParallel, queueExcess: true };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

/**
 * Batch 20260618T000943 shape: wave 0 (SP-278 + SP-280), wave 1 (SP-279).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 */
function seedPostMergeLimboState(projectRoot, batchId) {
	const orchBranch = `orch/spine-${batchId}`;
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [
			[TASK_W0_A, TASK_W0_B],
			[TASK_W1],
		],
		tasks: [
			{
				taskId: TASK_W0_A,
				laneNumber: 1,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W0_A}-gate-limbo`),
				doneFileFound: true,
			},
			{
				taskId: TASK_W0_B,
				laneNumber: 2,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W0_B}-gate-limbo`),
				doneFileFound: true,
			},
			{
				taskId: TASK_W1,
				laneNumber: 1,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_W1}-gate-limbo`),
				doneFileFound: true,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: projectRoot,
				branch: `task/spine-lane-1-${batchId}`,
				taskIds: [TASK_W0_A, TASK_W1],
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: projectRoot,
				branch: `task/spine-lane-2-${batchId}`,
				taskIds: [TASK_W0_B],
			},
		],
	});
	state.phase = "running";
	state.totalWaves = 2;
	state.currentWaveIndex = 1;
	state.segments = [
		{ segmentId: `${TASK_W0_A}::default`, taskId: TASK_W0_A, status: "succeeded", repoId: "default" },
		{ segmentId: `${TASK_W0_B}::default`, taskId: TASK_W0_B, status: "succeeded", repoId: "default" },
		{ segmentId: `${TASK_W1}::default`, taskId: TASK_W1, status: "succeeded", repoId: "default" },
	];
	state.mergeResults = [
		{ waveIndex: 0, status: "succeeded", mergeCommit: "c72cc3c52075e54c1dfa183f38043f1ef1a28ce3" },
		{ waveIndex: 1, status: "succeeded", mergeCommit: "aff02cacf6da0ac115bfa35a298b1b1c611cbb19" },
	];
	state.resilience = { enginePid: process.pid + 99_999 };
	saveSpineBatchState(projectRoot, state);
	return { state, orchBranch };
}

test("isLastWaveIndex matches batch 20260618T000943 wave plan", () => {
	const state = {
		totalWaves: 2,
		wavePlan: [[TASK_W0_A, TASK_W0_B], [TASK_W1]],
	};
	assert.equal(isLastWaveIndex(state, 0), false);
	assert.equal(isLastWaveIndex(state, 1), true);
});

test("maybeFinalizeAfterWaveMerge opens gate for last-wave post-merge limbo", async () => {
	const projectRoot = await initGitRepo("spine-attached-limbo-finalize-");
	const batchId = "20260618T000943";

	try {
		const { state, orchBranch } = seedPostMergeLimboState(projectRoot, batchId);
		assert.equal(isPostMergeLimbo(loadSpineBatchState(projectRoot).raw), true);

		const result = maybeFinalizeAfterWaveMerge({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId,
			orchBranch,
			waveIndex: 1,
		});
		assert.ok(result?.ok, result?.output ?? result?.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		const second = maybeFinalizeAfterWaveMerge({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId,
			orchBranch,
			waveIndex: 1,
		});
		assert.equal(second, null);

		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(events.filter((event) => event.type === "gate.opened").length, 1);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("resumeMultiTaskBatch finalizes post-merge limbo even with stale engine pid", async () => {
	const projectRoot = await initGitRepo("spine-attached-limbo-resume-");
	const batchId = "20260618T000943";
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const { orchBranch } = seedPostMergeLimboState(projectRoot, batchId);
		const loaded = loadSpineBatchState(projectRoot);
		loaded.raw.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, loaded.raw);

		const result = await resumeMultiTaskBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "gate.opened"));
		assert.ok(events.some((event) => event.type === "batch.completed"));
		assert.ok(events.some((event) => event.type === "engine.orphan_terminated"));
		assert.equal(String(orchBranch).length > 0, true);
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("terminateStaleDetachedEngine still clears stale engine during post-merge limbo resume handoff", async () => {
	const projectRoot = await initGitRepo("spine-attached-limbo-orphan-");
	const batchId = "20260618T000943";
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const { state } = seedPostMergeLimboState(projectRoot, batchId);
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);

		const result = terminateStaleDetachedEngine({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw,
			batchId,
			fromPhase: "running",
		});
		assert.equal(result.terminated, true);
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("startBatch multi-wave attached path opens gate after wave 1 without resume", async () => {
	const projectRoot = await initGitRepo("spine-attached-multi-wave-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		setMaxParallel(projectRoot, 2);
		writeSmokeTask(projectRoot, TASK_W0_A, "src/w0-a.txt");
		writeSmokeTask(projectRoot, TASK_W0_B, "src/w0-b.txt");
		writeSmokeTask(projectRoot, TASK_W1, "src/w1.txt");
		writeMultiWaveDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "multi-wave gate limbo tasks"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const result = await startBatch({
			projectRoot,
			scope: `${TASK_W0_A} ${TASK_W0_B} ${TASK_W1}`,
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(result.batchId);

		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed");
		assert.equal(final?.totalWaves, 2);
		assert.equal(final?.mergeResults?.length, 2);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, result.batchId)));

		const events = readJournalEvents(projectRoot, result.batchId);
		const mergeCompleted = events.filter((event) => event.type === "batch.merge_completed");
		assert.equal(mergeCompleted.length, 3, "wave 0 merges two lanes then wave 1");
		const lastMergeIndex = events.findLastIndex((event) => event.type === "batch.merge_completed");
		const gateIndex = events.findIndex((event) => event.type === "gate.opened");
		const batchCompletedIndex = events.findIndex((event) => event.type === "batch.completed");
		assert.ok(gateIndex > lastMergeIndex, "gate must open after last merge");
		assert.ok(batchCompletedIndex > gateIndex, "batch.completed after gate.opened");
		assert.equal(
			events.filter((event) => event.type === "batch.completed" && event.payload?.resumed !== true)
				.length,
			1,
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
