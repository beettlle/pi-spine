/**
 * SP-375 — attached engine honors operator pause and persists phase: paused (GitHub #57).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { startAttachedMilestoneReporter } from "../../src/batch/attached-runner.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	enforceOperatorPauseOnDisk,
	isOperatorPauseActive,
	mergeEngineStateWithDiskPause,
	pauseBatch,
	saveEngineBatchState,
} from "../../src/batch/pause.mjs";
import { recordResumePhaseTransition } from "../../src/batch/resume-common.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function writeRunningBatch(projectRoot, { batchId = "20260630T034859", taskId = "SP-375", enginePid = process.pid } = {}) {
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
				taskFolder: `spine-tasks/${taskId}-pause`,
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
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	recordBatchEnginePid(state, enginePid);
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId, state };
}

test("mergeEngineStateWithDiskPause adopts operator pause from disk", async () => {
	const projectRoot = await initGitRepo("spine-pause-merge-disk-");
	try {
		const { state } = writeRunningBatch(projectRoot);
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const engineState = structuredClone(state);
		engineState.phase = "running";
		const adopted = mergeEngineStateWithDiskPause(projectRoot, engineState);
		assert.equal(adopted, true);
		assert.equal(engineState.phase, "paused");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("saveEngineBatchState does not clobber phase paused during heartbeat-style saves", async () => {
	const projectRoot = await initGitRepo("spine-pause-save-engine-");
	try {
		const { state } = writeRunningBatch(projectRoot);
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const engineState = structuredClone(state);
		engineState.phase = "running";
		engineState.lanes[0].lastHeartbeatAt = Date.now();
		saveEngineBatchState(projectRoot, engineState);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("enforceOperatorPauseOnDisk re-asserts paused after engine overwrite", async () => {
	const projectRoot = await initGitRepo("spine-pause-enforce-");
	try {
		const { batchId } = writeRunningBatch(projectRoot);
		const paused = loadSpineBatchState(projectRoot).raw;
		paused.phase = "paused";
		saveSpineBatchState(projectRoot, paused);
		recordResumePhaseTransition(projectRoot, batchId, "running", "paused");

		const clobbered = loadSpineBatchState(projectRoot).raw;
		clobbered.phase = "running";
		saveSpineBatchState(projectRoot, clobbered);

		const reporter = await startAttachedMilestoneReporter({ projectRoot, write: () => {} });
		await new Promise((resolve) => setTimeout(resolve, 250));
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");
		assert.equal(isOperatorPauseActive(projectRoot, batchId), true);
		assert.equal(enforceOperatorPauseOnDisk(projectRoot), true);

		await reporter.stop();
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("pauseBatch confirms when attached engine heartbeat saves honor pause", async () => {
	const projectRoot = await initGitRepo("spine-pause-attached-confirm-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	await new Promise((resolve, reject) => {
		child.once("spawn", resolve);
		child.once("error", reject);
	});

	/** @type {ReturnType<typeof setInterval> | undefined} */
	let heartbeatInterval;
	try {
		writeRunningBatch(projectRoot, { enginePid: child.pid ?? null });
		heartbeatInterval = setInterval(() => {
			const loaded = loadSpineBatchState(projectRoot);
			if (!loaded.raw) return;
			const engineState = loaded.raw;
			engineState.phase = "running";
			engineState.lanes[0].lastHeartbeatAt = Date.now();
			saveEngineBatchState(projectRoot, engineState);
		}, 20);

		const reporter = await startAttachedMilestoneReporter({ projectRoot, write: () => {} });
		const pauseResult = await pauseBatch({
			projectRoot,
			confirmGraceMs: 1_500,
			pollIntervalMs: 50,
		});
		await reporter.stop();

		assert.equal(pauseResult.ok, true, pauseResult.output ?? pauseResult.error);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");

		const batchId = String(loadSpineBatchState(projectRoot).raw?.batchId ?? "");
		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.paused"));
		assert.equal(events.some((event) => event.type === "batch.pause_failed"), false);
	} finally {
		if (heartbeatInterval) clearInterval(heartbeatInterval);
		child.kill("SIGKILL");
		await destroyGitRepo(projectRoot);
	}
});
