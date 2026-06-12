import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { buildDashboardSnapshot } from "../../src/dashboard/snapshot.mjs";
import { DEFAULT_DASHBOARD_POLL_MS } from "../../src/dashboard/server.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function assertDiagnosisParity(projectRoot) {
	const reconcile = reconcileBatch({ projectRoot, verbose: true });
	const snapshot = buildDashboardSnapshot(projectRoot);
	assert.equal(snapshot.diagnosis, reconcile.diagnosis, "diagnosis");
	assert.equal(snapshot.headline, reconcile.headline, "headline");
	assert.equal(snapshot.suggestedCommand, reconcile.suggestedCommand, "suggestedCommand");
	assert.deepEqual(snapshot.alternatives, reconcile.alternatives ?? [], "alternatives");
	return { reconcile, snapshot };
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

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

test("NFR-OBS-02: dashboard SSE poll interval defaults to 2s", () => {
	assert.equal(DEFAULT_DASHBOARD_POLL_MS, 2000);
});

test("parity: idle — no batch", async () => {
	const projectRoot = await initGitRepo("spine-parity-idle-");
	try {
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: running batch", async () => {
	const projectRoot = await initGitRepo("spine-parity-running-");
	try {
		writePiBatchState(projectRoot, loadFixture("running-batch.json"));
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: needs_retry", async () => {
	const projectRoot = await initGitRepo("spine-parity-retry-");
	try {
		writePiBatchState(projectRoot, loadFixture("needs-retry-batch.json"));
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "needs_retry");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: limbo_stale", async () => {
	const projectRoot = await initGitRepo("spine-parity-limbo-");
	try {
		writePiBatchState(projectRoot, loadFixture("limbo-stale-20260531T165700.json"));
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "limbo_stale");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: completed_manual after manual merge", async () => {
	const projectRoot = await initGitRepo("spine-parity-manual-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);
		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", fixture.orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "completed_manual");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: needs_integrate", async () => {
	const projectRoot = await initGitRepo("spine-parity-integrate-");
	const orchBranch = "orch/spine-20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));
		const { reconcile, snapshot } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "needs_integrate");
		assert.ok(snapshot.defaultView.gateApplicable);
		assert.equal(snapshot.defaultView.gate?.status, "missing");
		assert.equal(snapshot.defaultView.headline, reconcile.headline);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: completed after integrate", async () => {
	const projectRoot = await initGitRepo("spine-parity-completed-");
	const orchBranch = "orch/spine-20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		execFileSync("git", ["merge", "--no-ff", orchBranch, "-m", "integrate orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("parity: failed phase still reconciles consistently", async () => {
	const projectRoot = await initGitRepo("spine-parity-failed-");
	try {
		const base = loadFixture("needs-retry-batch.json");
		writePiBatchState(projectRoot, {
			...base,
			phase: "failed",
			endedAt: Date.now(),
		});
		const { reconcile } = assertDiagnosisParity(projectRoot);
		assert.equal(reconcile.diagnosis, "needs_retry");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
