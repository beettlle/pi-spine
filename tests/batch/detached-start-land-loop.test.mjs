/**
 * SP-358 — detached start land loop finalize (batch 20260629T210738, GitHub #41).
 */

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";
import { resumeBatchDetached } from "../../src/batch/detached-start.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { detectPostMergeLimboForResume } from "../../src/batch/resume-multi-validate.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { provisionLaneWorktree } from "../../src/batch/worktree.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");
const BATCH_ID = "20260629T210738";
const TASK_A = "SP-348";
const TASK_B = "SP-349";

/**
 * Batch 20260629T210738 shape: two single-lane tasks, one wave, post-merge limbo after merge.
 *
 * @param {string} projectRoot
 */
/**
 * @param {string} projectRoot
 * @param {string} orchBranch
 */
function ensureOrchBranchAheadOfMain(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	const marker = path.join(projectRoot, `.orch-marker-${BATCH_ID}.txt`);
	fs.writeFileSync(marker, "orch-only\n", "utf-8");
	execFileSync("git", ["add", marker], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch marker"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

function seedBatch20260629T210738PostMergeLimbo(projectRoot) {
	const orchBranch = `orch/spine-${BATCH_ID}`;
	ensureOrchBranchAheadOfMain(projectRoot, orchBranch);
	provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
	provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[TASK_A, TASK_B]],
		tasks: [
			{
				taskId: TASK_A,
				laneNumber: 1,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_A}-limbo`),
				doneFileFound: true,
			},
			{
				taskId: TASK_B,
				laneNumber: 2,
				status: "succeeded",
				taskFolder: path.join("spine-tasks", `${TASK_B}-limbo`),
				doneFileFound: true,
				exitReason: "skipped_done_on_disk",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: path.join(projectRoot, ".worktrees", `spine-${BATCH_ID}`, "lane-1"),
				branch: `task/spine-lane-1-${BATCH_ID}`,
				taskIds: [TASK_A],
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: path.join(projectRoot, ".worktrees", `spine-${BATCH_ID}`, "lane-2"),
				branch: `task/spine-lane-2-${BATCH_ID}`,
				taskIds: [TASK_B],
			},
		],
	});
	state.phase = "running";
	state.totalWaves = 1;
	state.currentWaveIndex = 0;
	state.mergeResults = [];
	saveSpineBatchState(projectRoot, state);
	return { state, orchBranch };
}

/**
 * @param {string} projectRoot
 */
function seedJournalMergeCompleted(projectRoot) {
	appendJournalEvent(projectRoot, BATCH_ID, "batch.merge_completed", {
		mergeCommit: "c72cc3c52075e54c1dfa183f38043f1ef1a28ce3",
		laneNumber: 1,
		waveIndex: 0,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.merge_completed", {
		mergeCommit: "c72cc3c52075e54c1dfa183f38043f1ef1a28ce3",
		laneNumber: 2,
		waveIndex: 0,
	});
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-land-loop`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: "Detached land loop",
			fileScope: `src/${taskId}.txt`,
		}),
		"utf-8",
	);
}

test("detectPostMergeLimboForResume matches journal-only limbo for batch 20260629T210738", async () => {
	const projectRoot = await initGitRepo("spine-detached-land-loop-detect-");
	try {
		seedBatch20260629T210738PostMergeLimbo(projectRoot);
		seedJournalMergeCompleted(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(detectPostMergeLimboForResume({ projectRoot, state }), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("postMergeLimbo diagnosis suggests spine batch resume --force", () => {
	const command = buildSuggestedCommand("needs_integrate", {
		postMergeLimbo: true,
		phase: "running",
		integrateGateOpen: false,
	});
	assert.equal(command, "spine batch resume --force");
});

test("resumeBatchDetached --force finalizes journal-only limbo without spawning engine", async () => {
	const projectRoot = await initGitRepo("spine-detached-land-loop-resume-");
	const spineBin = path.join(projectRoot, "bin", "spine.mjs");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);

	try {
		const { state } = seedBatch20260629T210738PostMergeLimbo(projectRoot);
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);
		seedJournalMergeCompleted(projectRoot);

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
		assert.ok(events.some((event) => event.type === "batch.land_loop_finalized"));
		assert.ok(events.some((event) => event.type === "gate.opened"));
		assert.equal(loadSpineBatchState(projectRoot).raw?.resilience?.enginePid, undefined);
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("detached batch start opens integrate gate after stub engine completes", async () => {
	const projectRoot = await initGitRepo("spine-detached-land-loop-start-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSmokeTask(projectRoot, TASK_A);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [TASK_A]: [] } }, null, 2),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "land loop task"], { cwd: projectRoot, stdio: "ignore" });

		const startResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "batch", "start", TASK_A, "--skip-preflight", "--json"],
			{ cwd: projectRoot, encoding: "utf-8", env: process.env },
		);
		assert.equal(startResult.status, 0, startResult.stderr || startResult.stdout);
		const payload = JSON.parse(startResult.stdout);
		assert.equal(payload.ok, true);
		assert.equal(payload.detached, true);

		const deadline = Date.now() + 90_000;
		let batchId = null;
		while (Date.now() < deadline) {
			const { raw } = loadSpineBatchState(projectRoot);
			batchId = raw?.batchId ?? null;
			if (raw?.phase === "completed" || raw?.phase === "failed" || raw?.phase === "aborted") {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}

		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed", `expected completed, got ${final?.phase}`);
		assert.ok(batchId);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.land_loop_finalized"));
		assert.ok(events.some((event) => event.type === "gate.opened"));
		assert.equal(final?.resilience?.enginePid, undefined);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
