import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import {
	isBranchCheckedOutInWorktree,
	resolveIntegrateWorktreePath,
} from "../../src/batch/integrate-worktree.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { recordBatchBaseSnapshot } from "../../src/batch/integrate-worktree.mjs";
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

function gitRefHasPath(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["show", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

test("recordBatchBaseSnapshot stores head sha and journals batch.base_snapshot", async () => {
	const projectRoot = await initGitRepo("spine-integrate-isolated-snapshot-");
	const batchId = "20260702T120000";
	try {
		const mainHead = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		const state = {
			batchId,
			baseBranch: "main",
			phase: "planning",
		};

		recordBatchBaseSnapshot(projectRoot, state);

		assert.equal(state.baseBranchHeadAtStart, mainHead);
		assert.equal(
			state.integrateWorktreePath,
			path.join(".spine", "worktrees", `integrate-${batchId}`),
		);
		assert.equal(
			resolveIntegrateWorktreePath(projectRoot, batchId),
			path.join(projectRoot, state.integrateWorktreePath),
		);

		const events = readJournalEvents(projectRoot, batchId);
		const snapshot = events.find((event) => event.type === "batch.base_snapshot");
		assert.ok(snapshot);
		assert.equal(snapshot.payload.baseBranchHeadAtStart, mainHead);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase succeeds with uncommitted edits on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-isolated-dirty-");
	const orchBranch = "orch/spine-20260702T120000";
	const batchId = "20260702T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		fs.writeFileSync(path.join(projectRoot, "human-wip.txt"), "operator draft\n", "utf-8");
		assert.equal(isBranchCheckedOutInWorktree(projectRoot, "main"), true);

		const mainBefore = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);
		assert.ok(result.mergeCommit);
		assert.notEqual(result.mergeCommit, mainBefore);

		const onMain = execFileSync("git", ["branch", "--show-current"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(onMain, "main");
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "human-wip.txt"), "utf-8"),
			"operator draft\n",
		);
		assert.ok(gitRefHasPath(projectRoot, "main", "orch-work.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase conflict path leaves human checkout and files unchanged", async () => {
	const projectRoot = await initGitRepo("spine-integrate-isolated-conflict-");
	const orchBranch = "orch/spine-conflict";
	const batchId = "20260702T150000";
	try {
		fs.writeFileSync(path.join(projectRoot, "base-only.txt"), "on main\n", "utf-8");
		execFileSync("git", ["add", "base-only.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "main file"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "conflict.txt"), "orch version\n", "utf-8");
		execFileSync("git", ["add", "conflict.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "conflict.txt"), "main version\n", "utf-8");
		execFileSync("git", ["add", "conflict.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "main conflict"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "human-wip.txt"), "still editing\n", "utf-8");

		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const mainBefore = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "MergeConflict");
		assert.match(result.headline, /conflict/i);

		const onMain = execFileSync("git", ["branch", "--show-current"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(onMain, "main");
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "conflict.txt"), "utf-8"),
			"main version\n",
		);
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "human-wip.txt"), "utf-8"),
			"still editing\n",
		);
		assert.equal(
			execFileSync("git", ["rev-parse", "main"], { cwd: projectRoot, encoding: "utf-8" }).trim(),
			mainBefore,
		);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "integrate.failed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase dry-run advertises isolated merge plan", async () => {
	const projectRoot = await initGitRepo("spine-integrate-isolated-dryrun-");
	const orchBranch = "orch/spine-20260702T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));

		const result = integrateOrchToBase({ projectRoot, dryRun: true });
		assert.equal(result.ok, true);
		assert.match(result.mergePlan ?? "", /isolated/i);
		assert.doesNotMatch(result.mergePlan ?? "", /git checkout main/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
