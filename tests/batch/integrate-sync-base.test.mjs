import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { recordBatchBaseSnapshot } from "../../src/batch/integrate-worktree.mjs";
import { reconcileBatch, inspectHumanBaseSync } from "../../src/batch/reconcile.mjs";
import { syncHumanCheckoutWithBase } from "../../src/cli/sync-base.mjs";
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

function completedBatchFixture(orchBranch, batchId = "20260705T120000") {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
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

test("inspectHumanBaseSync reports integrate_isolated_ok after plumbing integrate leaves HEAD behind", async () => {
	const projectRoot = await initGitRepo("spine-sync-base-ok-");
	const orchBranch = "orch/spine-20260705T120000";
	const batchId = "20260705T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		recordBatchBaseSnapshot(projectRoot, fixture);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		fs.writeFileSync(path.join(projectRoot, "human-wip.txt"), "operator draft\n", "utf-8");

		const integrateResult = integrateOrchToBase({ projectRoot });
		assert.equal(integrateResult.ok, true, integrateResult.error ?? integrateResult.headline);

		const humanHead = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		const baseTip = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(humanHead, baseTip);
		fs.unlinkSync(path.join(projectRoot, "orch-work.txt"));

		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconciliation.diagnosis, "integrate_isolated_ok");
		assert.match(reconciliation.headline, /sync/i);
		assert.equal(reconciliation.suggestedCommand, "spine sync-base");

		const syncResult = syncHumanCheckoutWithBase({ projectRoot });
		assert.equal(syncResult.ok, true, syncResult.error ?? syncResult.headline);
		assert.equal(syncResult.synced, true);

		const humanHeadAfter = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(humanHeadAfter, baseTip);
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "human-wip.txt"), "utf-8"),
			"operator draft\n",
		);
		assert.ok(fs.existsSync(path.join(projectRoot, "orch-work.txt")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("inspectHumanBaseSync reports human_base_diverged when human commits overlap orch paths", async () => {
	const projectRoot = await initGitRepo("spine-sync-base-diverged-");
	const orchBranch = "orch/spine-20260705T130000";
	const batchId = "20260705T130000";
	try {
		const snapshotHead = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "shared.txt"), "orch version\n", "utf-8");
		execFileSync("git", ["add", "shared.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch shared"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		fs.writeFileSync(path.join(projectRoot, "shared.txt"), "human version\n", "utf-8");
		execFileSync("git", ["add", "shared.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "human shared"], { cwd: projectRoot, stdio: "ignore" });

		const fixture = {
			...completedBatchFixture(orchBranch, batchId),
			phase: "running",
			endedAt: null,
		};
		fixture.baseBranchHeadAtStart = snapshotHead;
		writeSpineBatchState(projectRoot, fixture);

		const inspection = inspectHumanBaseSync({
			projectRoot,
			baseBranch: "main",
			baseBranchHeadAtStart: snapshotHead,
			orchBranch,
			git: { inGitRepo: true, orchMergedToBase: false, orchBranchExists: true },
			journalEvents: [],
		});
		assert.ok(inspection);
		assert.equal(inspection.diagnosis, "human_base_diverged");
		assert.ok(inspection.overlapPaths?.includes("shared.txt"));

		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconciliation.diagnosis, "human_base_diverged");
		assert.equal(reconciliation.suggestedCommand, "spine sync-base");

		const syncResult = syncHumanCheckoutWithBase({
			projectRoot,
			inspection,
		});
		assert.equal(syncResult.ok, false);
		assert.ok(syncResult.overlapPaths?.includes("shared.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine sync-base CLI merges landed main into feature branch", async () => {
	const projectRoot = await initGitRepo("spine-sync-base-feature-");
	const orchBranch = "orch/spine-20260705T140000";
	const batchId = "20260705T140000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		execFileSync("git", ["checkout", "-b", "feature/wip"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "feature.txt"), "feature work\n", "utf-8");
		execFileSync("git", ["add", "feature.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "feature"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const fixture = completedBatchFixture(orchBranch, batchId);
		recordBatchBaseSnapshot(projectRoot, fixture);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const integrateResult = integrateOrchToBase({ projectRoot });
		assert.equal(integrateResult.ok, true, integrateResult.error ?? integrateResult.headline);

		execFileSync("git", ["checkout", "feature/wip"], { cwd: projectRoot, stdio: "ignore" });

		const syncResult = syncHumanCheckoutWithBase({ projectRoot });
		assert.equal(syncResult.ok, true, syncResult.error ?? syncResult.headline);
		assert.equal(syncResult.synced, true);
		assert.equal(syncResult.mode, "feature-merge");

		assert.ok(fs.existsSync(path.join(projectRoot, "orch-work.txt")));
		assert.ok(fs.existsSync(path.join(projectRoot, "feature.txt")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
