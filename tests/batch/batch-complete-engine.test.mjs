/**
 * SP-532 / M-HARNESS-02 — complete refuses archive while batch engine PID is alive (#173).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { formatLifecycleHuman } from "../../bin/spine-batch.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { archiveBatchStatePath, completeBatch } from "../../src/batch/lifecycle.mjs";
import {
	journalHasIntegrateProgressSignals,
	reloadStateForTerminalWrite,
} from "../../src/batch/lifecycle-archive.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { recordBatchEnginePid } from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 4_000_000;

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

/**
 * Serve a stale snapshot on the first read of `statePath`, then the real file
 * (SP-792 stale-writer pattern): simulates a concurrent engine save that lands
 * between a terminal write's pre-lock read and its in-lock reload.
 */
function serveStaleStateOnFirstRead(statePath, stale) {
	const realReadFileSync = fs.readFileSync;
	let served = false;
	fs.readFileSync = (/** @type {any[]} */ ...args) => {
		if (!served && String(args[0]) === statePath) {
			served = true;
			return `${JSON.stringify(stale, null, 2)}\n`;
		}
		return realReadFileSync(...args);
	};
	return () => {
		fs.readFileSync = realReadFileSync;
	};
}

function spawnLiveEngine() {
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	return new Promise((resolve, reject) => {
		child.once("spawn", () => resolve(child));
		child.once("error", reject);
	});
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

function completedBatchFixture(orchBranch, batchId = "20260601T120000") {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [
			{
				waveIndex: 0,
				status: "succeeded",
				failedLane: null,
				failureReason: null,
				mergeCommit: "deadbeef",
			},
		],
		tasks: [
			{
				taskId: "TP-012",
				status: "succeeded",
				taskFolder: "TP-012-single-lane-worker",
				doneFileFound: true,
			},
		],
		segments: [{ segmentId: "TP-012::default", taskId: "TP-012", status: "succeeded" }],
	};
}

function approveGateForIntegrate(projectRoot, fixture, batchId) {
	const config = loadSpineConfig(projectRoot).config;
	openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
	approveIntegrateGate({ projectRoot, batchId });
}

function prepareCompletableBatch(projectRoot) {
	const orchBranch = "orch/spine-20260601T120000";
	createOrchWithWork(projectRoot, orchBranch);
	const fixture = completedBatchFixture(orchBranch);
	writeSpineBatchState(projectRoot, fixture);
	approveGateForIntegrate(projectRoot, fixture, fixture.batchId);
	const integrate = integrateOrchToBase({ projectRoot });
	assert.equal(integrate.ok, true);
	return { fixture, orchBranch };
}

function pendingLaneLandFixture(orchBranch, batchId = "20260601T120000") {
	const taskFolder = "TP-012-single-lane-worker";
	const taskBranch = laneTaskBranch(batchId, 1);
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [
			{
				waveIndex: 0,
				status: "succeeded",
				failedLane: null,
				failureReason: null,
				mergeCommit: "deadbeef",
			},
		],
		tasks: [
			{
				taskId: "TP-012",
				status: "succeeded",
				taskFolder,
				doneFileFound: true,
				laneNumber: 1,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: `.worktrees/spine-${batchId}/lane-1`,
				branch: taskBranch,
				taskIds: ["TP-012"],
			},
		],
		segments: [{ segmentId: "TP-012::default", taskId: "TP-012", status: "succeeded" }],
	};
}

function setupLaneDoneNotOnMain(projectRoot, batchId, taskFolder) {
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = laneTaskBranch(batchId, 1);
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync("git", ["worktree", "add", "-b", taskBranch, wt, orchBranch], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	const laneTaskFolder = path.join(wt, "spine-tasks", taskFolder);
	fs.mkdirSync(laneTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "", "utf-8");
}

function preparePendingLaneLandBatch(projectRoot) {
	const batchId = "20260601T120000";
	const orchBranch = `orch/spine-${batchId}`;
	createOrchWithWork(projectRoot, orchBranch);
	const fixture = pendingLaneLandFixture(orchBranch, batchId);
	setupLaneDoneNotOnMain(projectRoot, batchId, fixture.tasks[0].taskFolder);
	writeSpineBatchState(projectRoot, fixture);
	approveGateForIntegrate(projectRoot, fixture, batchId);
	const integrate = integrateOrchToBase({ projectRoot });
	assert.equal(integrate.ok, true);
	return { fixture, batchId };
}

test("completeBatch refuses when lane .DONE exists but not on main (#201)", async () => {
	const projectRoot = await initGitRepo("spine-complete-pending-lane-");
	try {
		const { fixture, batchId } = preparePendingLaneLandBatch(projectRoot);
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");

		const result = completeBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "pending_lane_land");
		assert.equal(result.diagnosis, "pending_lane_land");
		assert.deepEqual(result.pendingTaskIds, ["TP-012"]);
		assert.equal(
			result.suggestedCommand,
			`spine batch salvage --batch ${batchId} --lane 1 --integrate`,
		);
		assert.match(result.headline ?? "", /lane work not on main/i);
		assert.ok(fs.existsSync(statePath), "active batch-state must not be archived");
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch refuses when batch engine PID is alive", async () => {
	const projectRoot = await initGitRepo("spine-complete-engine-alive-");
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	await new Promise((resolve, reject) => {
		child.once("spawn", resolve);
		child.once("error", reject);
	});

	try {
		const { fixture } = prepareCompletableBatch(projectRoot);
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
		recordBatchEnginePid(state, child.pid ?? 0);
		fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

		const result = completeBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.error, "engine_still_running");
		assert.equal(result.diagnosis, "engine_still_running");
		assert.equal(result.enginePid, child.pid);
		assert.equal(
			result.suggestedCommand,
			"spine wait --until completed,failed,needs_integrate --timeout 2h",
		);
		assert.match(result.headline ?? "", /engine still running/i);
		assert.ok(fs.existsSync(statePath), "active batch-state must not be archived");
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch succeeds when engine PID is null", async () => {
	const projectRoot = await initGitRepo("spine-complete-engine-null-");
	try {
		const { fixture } = prepareCompletableBatch(projectRoot);

		const result = completeBatch({ projectRoot });
		assert.equal(result.ok, true);
		assert.equal(result.diagnosis, "completed");
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));
		assert.ok(!fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch succeeds when engine PID is dead", async () => {
	const projectRoot = await initGitRepo("spine-complete-engine-dead-");
	try {
		const { fixture } = prepareCompletableBatch(projectRoot);
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
		recordBatchEnginePid(state, DEAD_PID);
		fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

		const result = completeBatch({ projectRoot });
		assert.equal(result.ok, true);
		assert.equal(result.diagnosis, "completed");
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reloadStateForTerminalWrite returns engine_finishing_land_loop for a live engine (injected liveness) (#371)", async () => {
	const projectRoot = await initGitRepo("spine-reload-land-loop-");
	try {
		const fixture = completedBatchFixture("orch/spine-20260601T120000");
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });

		const { refusal } = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
			deps: { isEngineAlive: () => true },
		});

		assert.equal(refusal.ok, false);
		assert.equal(refusal.pending, true);
		assert.equal(refusal.exitCode, 1);
		assert.equal(refusal.error, "engine_finishing_land_loop");
		assert.equal(refusal.headline, "Engine is finishing the land loop — wait for it to complete");
		assert.equal(refusal.suggestedCommand, "spine wait --until completed --timeout 10m");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reloadStateForTerminalWrite keeps the generic refusal when the engine PID is dead (#371)", async () => {
	const projectRoot = await initGitRepo("spine-reload-land-loop-dead-");
	try {
		const fixture = completedBatchFixture("orch/spine-20260601T120000");
		const state = { ...fixture, phase: "running" };
		recordBatchEnginePid(state, DEAD_PID);
		writeSpineBatchState(projectRoot, state);

		const { refusal } = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
		});

		assert.equal(refusal.pending, undefined);
		assert.equal(refusal.error, "batch_state_changed_during_terminal_write");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reloadStateForTerminalWrite returns pending for a PID-less active state inside the finalize window (#379)", async () => {
	const projectRoot = await initGitRepo("spine-reload-finalize-window-");
	try {
		const fixture = completedBatchFixture("orch/spine-20260601T120000");
		// #379: finalize clears the engine PID (#198) before writing the terminal
		// phase — an active phase with no recorded PID mid-finalize.
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		// Real production signals, not mocks: gate approval + integrate completed.
		appendJournalEvent(projectRoot, fixture.batchId, "gate.approved", { batchId: fixture.batchId });
		appendJournalEvent(projectRoot, fixture.batchId, "integrate.completed", {
			batchId: fixture.batchId,
		});

		const { refusal } = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
			// No deps: the default journal probe must detect the finalize window.
		});

		assert.equal(refusal.pending, true);
		assert.equal(refusal.error, "engine_finishing_land_loop");
		assert.equal(refusal.exitCode, 1);
		assert.equal(refusal.headline, "Engine is finishing the land loop — wait for it to complete");
		assert.equal(refusal.suggestedCommand, "spine wait --until completed --timeout 10m");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reloadStateForTerminalWrite keeps the generic refusal for a PID-less active state with no approval signals (fail-closed)", async () => {
	const projectRoot = await initGitRepo("spine-reload-pidless-no-signals-");
	try {
		const fixture = completedBatchFixture("orch/spine-20260601T120000");
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		// No gate.approved / integrate.completed journal events: a paused batch
		// or a resumed-for-real-work batch must keep failing closed.

		const { refusal } = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
		});

		assert.equal(refusal.pending, undefined);
		assert.equal(refusal.error, "batch_state_changed_during_terminal_write");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reloadStateForTerminalWrite keeps the generic refusal for a recorded-but-dead PID even inside the finalize window (#371)", async () => {
	const projectRoot = await initGitRepo("spine-reload-dead-pid-signals-");
	try {
		const fixture = completedBatchFixture("orch/spine-20260601T120000");
		const state = { ...fixture, phase: "running" };
		recordBatchEnginePid(state, DEAD_PID);
		writeSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, fixture.batchId, "gate.approved", { batchId: fixture.batchId });
		appendJournalEvent(projectRoot, fixture.batchId, "integrate.completed", {
			batchId: fixture.batchId,
		});
		assert.equal(
			journalHasIntegrateProgressSignals(projectRoot, fixture.batchId),
			true,
			"setup: approval signals must be present so this pins the dead-PID distinction",
		);

		const { refusal } = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
		});

		assert.equal(refusal.pending, undefined);
		assert.equal(refusal.error, "batch_state_changed_during_terminal_write");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reloadStateForTerminalWrite ORs the injected isFinalizeInFlight probe with journal signals (#379)", async () => {
	const projectRoot = await initGitRepo("spine-reload-finalize-inject-");
	try {
		const fixture = completedBatchFixture("orch/spine-20260601T120000");

		// No journal signals: a `false` probe must not force the pending wait —
		// the generic hard refusal still applies (fail-closed preserved).
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		const probeFalseNoSignals = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
			deps: { isFinalizeInFlight: () => false },
		});
		assert.equal(probeFalseNoSignals.refusal.pending, undefined);
		assert.equal(
			probeFalseNoSignals.refusal.error,
			"batch_state_changed_during_terminal_write",
		);

		// No journal signals: a `true` probe still forces the pending wait.
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		const probeTrueNoSignals = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
			deps: { isFinalizeInFlight: () => true },
		});
		assert.equal(probeTrueNoSignals.refusal.pending, true);
		assert.equal(probeTrueNoSignals.refusal.error, "engine_finishing_land_loop");

		// `||`, not `??`: a `false` probe defers to the journal fallback, so
		// journaled approval signals still yield the pending wait instead of a
		// hard refusal that implies corruption.
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		appendJournalEvent(projectRoot, fixture.batchId, "gate.approved", {
			batchId: fixture.batchId,
		});
		const probeFalseWithSignals = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: path.join(projectRoot, ".spine", "batch-state.json"),
			batchId: fixture.batchId,
			action: "complete",
			requireTerminalPhase: true,
			deps: { isFinalizeInFlight: () => false },
		});
		assert.equal(
			probeFalseWithSignals.refusal.pending,
			true,
			"journal fallback must decide when the injected probe returns false",
		);
		assert.equal(probeFalseWithSignals.refusal.error, "engine_finishing_land_loop");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("formatLifecycleHuman prints Batch lifecycle pending for pending refusals (#371)", () => {
	const output = formatLifecycleHuman({
		ok: false,
		exitCode: 1,
		pending: true,
		error: "engine_finishing_land_loop",
		headline: "Engine is finishing the land loop — wait for it to complete",
		suggestedCommand: "spine wait --until completed --timeout 10m",
		batchId: "20260601T120000",
	});
	assert.match(output, /Batch lifecycle pending/);
	assert.doesNotMatch(output, /Batch lifecycle failed/);
	assert.match(output, /Engine is finishing the land loop/);
	assert.match(output, /spine wait --until completed --timeout 10m/);
});

test("completeBatch reports pending while a live engine finishes its land loop (#371)", async () => {
	const projectRoot = await initGitRepo("spine-complete-land-loop-");
	/** @type {import("node:child_process").ChildProcess|null} */
	let child = null;
	try {
		child = await spawnLiveEngine();
		const { fixture } = prepareCompletableBatch(projectRoot);
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		// #371 race: the engine's land-loop save (active phase + live PID) lands
		// between the pre-lock read and the in-lock reload. Serve the terminal
		// pre-lock snapshot on the first read; the in-lock re-read sees running.
		const onDisk = { ...fixture, phase: "running" };
		recordBatchEnginePid(onDisk, child.pid ?? 0);
		writeSpineBatchState(projectRoot, onDisk);
		const restore = serveStaleStateOnFirstRead(statePath, fixture);
		let result;
		try {
			result = completeBatch({ projectRoot });
		} finally {
			restore();
		}

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.pending, true);
		assert.equal(result.error, "engine_finishing_land_loop");
		assert.equal(result.headline, "Engine is finishing the land loop — wait for it to complete");
		assert.equal(result.suggestedCommand, "spine wait --until completed --timeout 10m");
		assert.ok(fs.existsSync(statePath), "active batch-state must not be archived");
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));
	} finally {
		try {
			child?.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch keeps the generic refusal when the land-loop engine PID is dead (#371)", async () => {
	const projectRoot = await initGitRepo("spine-complete-land-loop-dead-");
	try {
		const { fixture } = prepareCompletableBatch(projectRoot);
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		const onDisk = { ...fixture, phase: "running" };
		recordBatchEnginePid(onDisk, DEAD_PID);
		writeSpineBatchState(projectRoot, onDisk);
		const restore = serveStaleStateOnFirstRead(statePath, fixture);
		let result;
		try {
			result = completeBatch({ projectRoot });
		} finally {
			restore();
		}

		assert.equal(result.ok, false);
		assert.equal(result.pending, undefined);
		assert.equal(result.error, "batch_state_changed_during_terminal_write");
		assert.equal(result.headline, "Batch state changed during complete — re-run spine status --diagnose");
		assert.ok(fs.existsSync(statePath), "active batch-state must not be archived");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch reports pending — not a hard failure — for the first complete after integrate while finalize holds a PID-less active state (#379)", async () => {
	const projectRoot = await initGitRepo("spine-complete-finalize-window-");
	try {
		const { fixture } = prepareCompletableBatch(projectRoot);
		const statePath = path.join(projectRoot, ".spine", "batch-state.json");
		// #379 finalize window: finalizeBatchForIntegrate clears the engine PID
		// (#198) and saves BEFORE writing phase: completed, so the engine's
		// finalize save leaves an active phase with no recorded PID on disk while
		// the operator's pre-lock read already saw the terminal snapshot.
		writeSpineBatchState(projectRoot, { ...fixture, phase: "running" });
		const restore = serveStaleStateOnFirstRead(statePath, fixture);
		let first;
		try {
			first = completeBatch({ projectRoot });
		} finally {
			restore();
		}

		assert.equal(first.ok, false);
		assert.equal(first.exitCode, 1);
		assert.equal(
			first.pending,
			true,
			"first complete after integrate must be pending, not batch_state_changed_during_terminal_write",
		);
		assert.equal(first.error, "engine_finishing_land_loop");
		assert.equal(first.headline, "Engine is finishing the land loop — wait for it to complete");
		assert.equal(first.suggestedCommand, "spine wait --until completed --timeout 10m");
		assert.ok(fs.existsSync(statePath), "active batch-state must not be archived");
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));

		// The engine's finalize lands: the terminal phase is persisted.
		writeSpineBatchState(projectRoot, fixture);

		// The reported symptom "retry works": the next complete succeeds.
		const second = completeBatch({ projectRoot });
		assert.equal(second.ok, true, second.headline ?? second.error);
		assert.equal(second.diagnosis, "completed");
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, fixture.batchId)));
		assert.ok(!fs.existsSync(statePath), "active batch-state is cleared after complete");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
