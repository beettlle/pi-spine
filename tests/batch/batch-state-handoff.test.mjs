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
import { startBatch } from "../../src/batch/engine.mjs";
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

test("clearStaleTerminalBatchStateForStart quarantines corrupt spine state instead of deleting it", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-quarantine-"));
	try {
		const statePath = spineBatchStatePath(projectRoot);
		fs.mkdirSync(path.dirname(statePath), { recursive: true });
		const corrupt = "{ not valid json !!!";
		fs.writeFileSync(statePath, corrupt, "utf-8");

		const result = clearStaleTerminalBatchStateForStart(projectRoot);
		assert.equal(result.cleared, false);
		assert.equal(result.reason, "corrupt");
		assert.ok(result.quarantinedPath, "quarantinedPath is returned");
		assert.match(result.quarantinedPath, /batch-state\.corrupt-.+\.json$/);
		assert.equal(path.dirname(result.quarantinedPath), path.dirname(statePath));

		// Original path is gone, but the file was renamed, never deleted.
		assert.equal(fs.existsSync(statePath), false);
		assert.equal(fs.readFileSync(result.quarantinedPath, "utf-8"), corrupt);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("clearActiveBatchStateIfMatches quarantines corrupt active state instead of deleting it", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-quarantine2-"));
	try {
		const statePath = spineBatchStatePath(projectRoot);
		fs.mkdirSync(path.dirname(statePath), { recursive: true });
		const corrupt = "{ corruption }";
		fs.writeFileSync(statePath, corrupt, "utf-8");

		const result = clearActiveBatchStateIfMatches(statePath, OLD_BATCH, projectRoot);
		assert.equal(result.cleared, false);
		assert.equal(result.reason, "corrupt");
		assert.ok(result.quarantinedPath, "quarantinedPath is returned");
		assert.match(result.quarantinedPath, /batch-state\.corrupt-.+\.json$/);
		assert.equal(path.dirname(result.quarantinedPath), path.dirname(statePath));

		assert.equal(fs.existsSync(statePath), false);
		assert.equal(fs.readFileSync(result.quarantinedPath, "utf-8"), corrupt);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("corrupt .pi/batch-state.json is reported, never modified by start or clear", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-foreign-"));
	try {
		const piPath = path.join(projectRoot, ".pi", "batch-state.json");
		fs.mkdirSync(path.dirname(piPath), { recursive: true });
		const corrupt = "{ corrupt .pi state";
		fs.writeFileSync(piPath, corrupt, "utf-8");

		const startClear = clearStaleTerminalBatchStateForStart(projectRoot);
		assert.equal(startClear.cleared, false);
		assert.equal(startClear.reason, "foreign_state");

		const activeClear = clearActiveBatchStateIfMatches(piPath, OLD_BATCH, projectRoot);
		assert.equal(activeClear.cleared, false);
		assert.equal(activeClear.reason, "foreign_state");

		assert.equal(fs.existsSync(piPath), true);
		assert.equal(fs.readFileSync(piPath, "utf-8"), corrupt);

		// Start gate reports the corrupt foreign file without modifying it.
		assert.throws(() => assertNoActiveBatch(projectRoot), /left unmodified by spine/);
		assert.equal(fs.readFileSync(piPath, "utf-8"), corrupt);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("terminal .pi/batch-state.json survives the start gate untouched", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-foreign-term-"));
	try {
		const piPath = path.join(projectRoot, ".pi", "batch-state.json");
		fs.mkdirSync(path.dirname(piPath), { recursive: true });
		fs.writeFileSync(
			piPath,
			JSON.stringify({ id: "tp-terminal", phase: "completed", endedAt: Date.now() }),
			"utf-8",
		);

		const result = clearStaleTerminalBatchStateForStart(projectRoot);
		assert.equal(result.cleared, false);
		assert.equal(result.reason, "foreign_state");

		assert.doesNotThrow(() => assertNoActiveBatch(projectRoot));
		assert.equal(fs.existsSync(piPath), true);
		assert.equal(JSON.parse(fs.readFileSync(piPath, "utf-8")).id, "tp-terminal");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("startBatch refuses with skipPreflight when spine state is corrupt (quarantine message)", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-handoff-startrefuses-"));
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(spineBatchStatePath(projectRoot), "{ corrupt before start", "utf-8");

		// skipPreflight: true must not bypass the fail-closed corrupt-state gate.
		await assert.rejects(
			() => startBatch({ projectRoot, skipPreflight: true }),
			/Batch state was corrupt and has been quarantined to .+spine batch dismiss --force/s,
		);

		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);
		const quarantined = fs
			.readdirSync(path.join(projectRoot, ".spine"))
			.filter((name) => name.startsWith("batch-state.corrupt-"));
		assert.equal(quarantined.length, 1);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
