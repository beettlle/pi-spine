import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runInit } from "../../bin/spine-init.mjs";
import {
	clearActiveBatchStateIfMatches,
	clearStaleTerminalBatchStateForStart,
	loadBatchStateFile,
} from "../../src/batch/batch-state-io.mjs";
import { archiveBatchStatePath, completeBatch } from "../../src/batch/lifecycle.mjs";
import {
	assertNoActiveBatch,
	createInitialBatchState,
	saveSpineBatchState,
	spineBatchStatePath,
} from "../../src/batch/state.mjs";
import { runBatchComplete } from "../../src/cli/batch-complete.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");
const OLD_BATCH = "20260702T073511";
const NEW_BATCH = "20260702T073937";

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

async function createProjectFixture() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-"));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	runInit(projectRoot, ["--tasks-root", "taskplane-tasks"]);
	execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });
	return projectRoot;
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(spineBatchStatePath(projectRoot), `${JSON.stringify(fixture, null, 2)}\n`, "utf-8");
}

test("complete handoff preserves newer active batch (073511 vs 073937 race)", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-race-"));
	try {
		const oldFixture = {
			schemaVersion: 1,
			batchId: OLD_BATCH,
			phase: "completed",
			endedAt: Date.now(),
			baseBranch: "main",
			orchBranch: `orch/spine-${OLD_BATCH}`,
			startedAt: Date.now() - 60_000,
			updatedAt: Date.now(),
			totalTasks: 1,
			tasks: [{ taskId: "SP-413", laneNumber: 1, status: "succeeded" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-413"] }],
			wavePlan: [["SP-413"]],
			mergeResults: [],
			segments: [{ segmentId: "SP-413::default", taskId: "SP-413", status: "succeeded" }],
			succeededTasks: 1,
			failedTasks: 0,
			skippedTasks: 0,
			blockedTasks: 0,
			blockedTaskIds: [],
		};
		writeSpineBatchState(projectRoot, oldFixture);

		const newState = createInitialBatchState({
			batchId: NEW_BATCH,
			baseBranch: "main",
			orchBranch: `orch/spine-${NEW_BATCH}`,
			wavePlan: [["SP-413"], ["SP-417"]],
			tasks: [
				{ taskId: "SP-413", laneNumber: 1, status: "running" },
				{ taskId: "SP-417", laneNumber: 2, status: "pending" },
			],
			lanes: [
				{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-413"] },
				{ laneNumber: 2, laneId: "lane-2", taskIds: ["SP-417"] },
			],
		});
		newState.phase = "running";
		saveSpineBatchState(projectRoot, newState, { bypassWriteGuard: true });

		const clearResult = clearActiveBatchStateIfMatches(spineBatchStatePath(projectRoot), OLD_BATCH);
		assert.equal(clearResult.cleared, false);
		assert.equal(clearResult.reason, "batch_id_mismatch");
		assert.equal(clearResult.activeBatchId, NEW_BATCH);

		const loaded = loadBatchStateFile(projectRoot);
		assert.equal(loaded.raw?.batchId, NEW_BATCH);
		assert.equal(loaded.raw?.phase, "running");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("clearStaleTerminalBatchStateForStart removes completed batch-state pointer", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-clear-"));
	try {
		writeSpineBatchState(projectRoot, {
			schemaVersion: 1,
			batchId: OLD_BATCH,
			phase: "completed",
			endedAt: Date.now(),
			baseBranch: "main",
			orchBranch: `orch/spine-${OLD_BATCH}`,
			startedAt: Date.now() - 30_000,
			updatedAt: Date.now(),
			totalTasks: 0,
			tasks: [],
			lanes: [],
			wavePlan: [],
			mergeResults: [],
			segments: [],
			succeededTasks: 0,
			failedTasks: 0,
			skippedTasks: 0,
		});

		const result = clearStaleTerminalBatchStateForStart(projectRoot);
		assert.equal(result.cleared, true);
		assert.equal(result.reason, "stale_terminal");
		assert.equal(result.batchId, OLD_BATCH);
		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("assertNoActiveBatch clears stale completed pointer before start handoff", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-start-"));
	try {
		writeSpineBatchState(projectRoot, {
			schemaVersion: 1,
			batchId: OLD_BATCH,
			phase: "completed",
			endedAt: Date.now(),
			baseBranch: "main",
			orchBranch: `orch/spine-${OLD_BATCH}`,
			startedAt: Date.now() - 30_000,
			updatedAt: Date.now(),
			totalTasks: 0,
			tasks: [],
			lanes: [],
			wavePlan: [],
			mergeResults: [],
			segments: [],
			succeededTasks: 0,
			failedTasks: 0,
			skippedTasks: 0,
		});

		assert.doesNotThrow(() => assertNoActiveBatch(projectRoot));
		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runBatchComplete clears active batch-state when no newer batch took over", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writeSpineBatchState(projectRoot, fixture);

		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", fixture.orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const result = runBatchComplete({ projectRoot, detectManualMerge: true });
		assert.equal(result.ok, true);
		assert.equal(result.batchId, fixture.batchId);

		const archivePath = archiveBatchStatePath(projectRoot, fixture.batchId);
		assert.ok(fs.existsSync(archivePath));
		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);

		const completedViaLifecycle = completeBatch({ projectRoot });
		assert.equal(completedViaLifecycle.ok, false);
		assert.match(completedViaLifecycle.headline ?? "", /No active batch/i);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("new batch save replaces terminal completed cache with different batchId", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-save-"));
	try {
		writeSpineBatchState(projectRoot, {
			schemaVersion: 1,
			batchId: OLD_BATCH,
			phase: "completed",
			endedAt: Date.now(),
			baseBranch: "main",
			orchBranch: `orch/spine-${OLD_BATCH}`,
			startedAt: Date.now() - 30_000,
			updatedAt: Date.now(),
			totalTasks: 1,
			tasks: [{ taskId: "SP-413", laneNumber: 1, status: "succeeded" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-413"] }],
			wavePlan: [["SP-413"]],
			mergeResults: [],
			segments: [{ segmentId: "SP-413::default", taskId: "SP-413", status: "succeeded" }],
			succeededTasks: 1,
			failedTasks: 0,
			skippedTasks: 0,
		});

		const next = createInitialBatchState({
			batchId: NEW_BATCH,
			baseBranch: "main",
			orchBranch: `orch/spine-${NEW_BATCH}`,
			wavePlan: [["SP-413"], ["SP-417"]],
			tasks: [
				{ taskId: "SP-413", laneNumber: 1, status: "pending" },
				{ taskId: "SP-417", laneNumber: 2, status: "pending" },
			],
			lanes: [
				{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-413"] },
				{ laneNumber: 2, laneId: "lane-2", taskIds: ["SP-417"] },
			],
		});
		next.phase = "planning";
		saveSpineBatchState(projectRoot, next);

		const loaded = loadBatchStateFile(projectRoot);
		assert.equal(loaded.raw?.batchId, NEW_BATCH);
		assert.equal(loaded.raw?.phase, "planning");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
