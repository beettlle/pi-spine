import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import {
	syncPlumbingMergePathsToWorktree,
	DEFAULT_SYNC_TIMEOUT_MS,
} from "../../src/batch/integrate-worktree.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

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

test("DEFAULT_SYNC_TIMEOUT_MS is 60 seconds", () => {
	assert.equal(DEFAULT_SYNC_TIMEOUT_MS, 60_000);
});

test("syncPlumbingMergePathsToWorktree returns ok: true on successful sync", async () => {
	const projectRoot = await initGitRepo("spine-sync-timeout-ok-");
	try {
		execFileSync("git", ["checkout", "-b", "orch/sync-ok"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "new-file.txt"), "content\n", "utf-8");
		execFileSync("git", ["add", "new-file.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add file"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);

		assert.equal(result.ok, true);
		assert.equal(typeof result.processedPaths, "number");
		assert.ok(result.processedPaths >= 1);
		assert.equal(typeof result.totalPaths, "number");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree returns ok: false with timedOut on timeout", async () => {
	const projectRoot = await initGitRepo("spine-sync-timeout-fail-");
	try {
		execFileSync("git", ["checkout", "-b", "orch/sync-timeout"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.writeFileSync(path.join(projectRoot, "file.txt"), "content\n", "utf-8");
		execFileSync("git", ["add", "file.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit, {
			timeoutMs: 1,
		});

		assert.equal(result.ok, false);
		assert.equal(result.timedOut, true);
		assert.equal(typeof result.error, "string");
		assert.match(result.error, /timed out/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase emits integrate.failed with IntegrateTimeout on sync timeout", async () => {
	const projectRoot = await initGitRepo("spine-integrate-timeout-");
	const orchBranch = "orch/spine-20260703T120000";
	const batchId = "20260703T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const origEnv = process.env.SPINE_SYNC_TIMEOUT_MS;
		process.env.SPINE_SYNC_TIMEOUT_MS = "1";
		try {
			const result = integrateOrchToBase({ projectRoot });

			assert.equal(result.ok, false);
			assert.equal(result.failureClass, "IntegrateTimeout");
			assert.equal(result.mergeCommitLanded, true);
			assert.ok(result.headline);
			assert.match(result.headline, /timed out/i);

			const events = readJournalEvents(projectRoot, batchId);
			assert.ok(events.some((e) => e.type === "integrate.started"));
			const failedEvent = events.find((e) => e.type === "integrate.failed");
			assert.ok(failedEvent, "integrate.failed event must be journaled");
			assert.equal(failedEvent.payload.timeout, true);
			assert.equal(failedEvent.payload.mergeCommitLanded, true);
			assert.ok(failedEvent.payload.mergeCommit);
		} finally {
			if (origEnv === undefined) {
				delete process.env.SPINE_SYNC_TIMEOUT_MS;
			} else {
				process.env.SPINE_SYNC_TIMEOUT_MS = origEnv;
			}
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("successful integrate still emits integrate.completed (regression)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-timeout-happy-");
	const orchBranch = "orch/spine-20260703T130000";
	const batchId = "20260703T130000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true);
		assert.ok(result.mergeCommit);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((e) => e.type === "integrate.started"));
		assert.ok(events.some((e) => e.type === "integrate.completed"));
		assert.ok(!events.some((e) => e.type === "integrate.failed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("partial sync failure returns ok: false with correct failureClass from integrateOrchToBase", async () => {
	const projectRoot = await initGitRepo("spine-integrate-partial-sync-");
	const orchBranch = "orch/spine-20260703T140000";
	const batchId = "20260703T140000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const origEnv = process.env.SPINE_SYNC_TIMEOUT_MS;
		process.env.SPINE_SYNC_TIMEOUT_MS = "1";
		try {
			const result = integrateOrchToBase({ projectRoot });

			assert.equal(result.ok, false);
			assert.ok(
				result.failureClass === "IntegrateTimeout" || result.failureClass === "IntegrateFailed",
				`failureClass should be IntegrateTimeout or IntegrateFailed, got ${result.failureClass}`,
			);
			assert.equal(result.mergeCommitLanded, true);
			assert.ok(result.error);
			assert.equal(result.exitCode, 1);
		} finally {
			if (origEnv === undefined) {
				delete process.env.SPINE_SYNC_TIMEOUT_MS;
			} else {
				process.env.SPINE_SYNC_TIMEOUT_MS = origEnv;
			}
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
