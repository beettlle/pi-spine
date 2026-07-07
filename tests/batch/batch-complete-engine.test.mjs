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
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { archiveBatchStatePath, completeBatch } from "../../src/batch/lifecycle.mjs";
import { recordBatchEnginePid } from "../../src/batch/state.mjs";
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
