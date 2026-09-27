import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { integrateSalvageableLane } from "../../src/batch/salvage-batch-integrate.mjs";
import { createInitialBatchState } from "../../src/batch/state.mjs";
import { archiveBatchStatePath } from "../../src/batch/lifecycle.mjs";
import { laneTaskBranch } from "../../src/batch/worktree.mjs";
import {
	isBranchCheckedOutInWorktree,
	resolveIntegrateWorktreePath,
} from "../../src/batch/integrate-worktree.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
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

test("integrateOrchToBase succeeds with uncommitted edits on feature branch (non-base)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-isolated-dirty-feature-");
	const orchBranch = "orch/spine-20260702T130000";
	const batchId = "20260702T130000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		execFileSync("git", ["checkout", "-b", "feature/wip"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "human-wip.txt"), "feature branch draft\n", "utf-8");
		assert.equal(isBranchCheckedOutInWorktree(projectRoot, "main"), false);

		const mainBefore = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		const porcelainBefore = execFileSync("git", ["status", "--porcelain"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);
		assert.ok(result.mergeCommit);
		assert.notEqual(result.mergeCommit, mainBefore);

		// SP-784: the checkout must be untouched — no staged base changes, no lost edits.
		assert.equal(
			execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf-8" }),
			porcelainBefore,
		);
		assert.equal(result.warnings, undefined);

		const onFeature = execFileSync("git", ["branch", "--show-current"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(onFeature, "feature/wip");
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "human-wip.txt"), "utf-8"),
			"feature branch draft\n",
		);
		assert.ok(gitRefHasPath(projectRoot, "main", "orch-work.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase with base checked out keeps dirty merged path and reports overlap (SP-784)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-isolated-overlap-");
	const orchBranch = "orch/spine-20260702T150000";
	const batchId = "20260702T150000";
	try {
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "baseline\n", "utf-8");
		execFileSync("git", ["add", "tracked.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tracked baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "orch version\n", "utf-8");
		execFileSync("git", ["add", "tracked.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch edits tracked"], { cwd: projectRoot, stdio: "ignore" });

		// Advance main past the fork point so the merge is a plumbing merge, not a fast-forward.
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "main-only.txt"), "main work\n", "utf-8");
		execFileSync("git", ["add", "main-only.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "main advances"], { cwd: projectRoot, stdio: "ignore" });

		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		// Operator edit on the path the merge wants to update.
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "operator uncommitted edit\n", "utf-8");

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);
		assert.ok(result.mergeCommit);

		// The uncommitted edit survives; the merge commit is on main.
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "tracked.txt"), "utf-8"),
			"operator uncommitted edit\n",
		);
		assert.equal(
			execFileSync("git", ["show", "main:tracked.txt"], { cwd: projectRoot, encoding: "utf-8" }),
			"orch version\n",
		);

		assert.deepEqual(result.warnings, [
			"DirtyOverlap: tracked.txt kept local edits — run git diff / git restore --source main -- tracked.txt after review",
		]);

		const events = readJournalEvents(projectRoot, batchId);
		const overlap = events.find((event) => event.type === "integrate.dirty_overlap");
		assert.ok(overlap);
		assert.deepEqual(overlap.payload.skippedDirtyPaths, ["tracked.txt"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

const SALVAGE_BATCH_ID = "20260703T231500";

function writeArchivedAbortedBatch(projectRoot) {
	const state = createInitialBatchState({
		batchId: SALVAGE_BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${SALVAGE_BATCH_ID}`,
		wavePlan: [["SP-470"], ["SP-471"]],
		tasks: [
			{
				taskId: "SP-470",
				laneNumber: 1,
				status: "succeeded",
				taskFolder: "spine-tasks/SP-470-fixture",
				doneFileFound: true,
				exitReason: "done",
			},
			{
				taskId: "SP-471",
				laneNumber: 2,
				status: "failed",
				taskFolder: "spine-tasks/SP-471-fixture",
				doneFileFound: false,
				exitReason: "contract_failed",
			},
		],
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-470"] },
			{ laneNumber: 2, laneId: "lane-2", taskIds: ["SP-471"] },
		],
	});
	state.phase = "aborted";
	state.endedAt = Date.now();
	const archivePath = archiveBatchStatePath(projectRoot, SALVAGE_BATCH_ID);
	fs.mkdirSync(path.dirname(archivePath), { recursive: true });
	fs.writeFileSync(archivePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
	return state;
}

function seedSalvageableLaneJournal(projectRoot) {
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "batch.started", {
		baseBranch: "main",
		orchBranch: `orch/spine-${SALVAGE_BATCH_ID}`,
	});
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "task.started", { taskId: "SP-470", laneNumber: 1 });
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "lane.committed", {
		taskId: "SP-470",
		laneNumber: 1,
		commitSha: "lane1sha",
	});
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "task.completed", {
		taskId: "SP-470",
		doneFileFound: true,
		exitReason: "done",
	});
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "task.started", { taskId: "SP-471", laneNumber: 2 });
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "lane.committed", {
		taskId: "SP-471",
		laneNumber: 2,
		commitSha: "lane2sha",
	});
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "task.failed", {
		taskId: "SP-471",
		exitReason: "contract_failed",
		classification: "contract_failed",
	});
	appendJournalEvent(projectRoot, SALVAGE_BATCH_ID, "batch.aborted", { reason: "operator abort" });
}

test("integrateSalvageableLane keeps dirty merged path and reports overlap (SP-784)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-salvage-dirty-");
	try {
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "baseline\n", "utf-8");
		execFileSync("git", ["add", "tracked.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tracked baseline"], { cwd: projectRoot, stdio: "ignore" });

		const batchState = writeArchivedAbortedBatch(projectRoot);
		seedSalvageableLaneJournal(projectRoot);

		const laneBranch = laneTaskBranch(SALVAGE_BATCH_ID, 1);
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "lane version\n", "utf-8");
		execFileSync("git", ["add", "tracked.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane salvage work"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		approveGateForIntegrate(projectRoot, batchState, SALVAGE_BATCH_ID);

		// Operator edit on the path the salvage merge wants to update.
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "operator uncommitted edit\n", "utf-8");

		const result = await integrateSalvageableLane(projectRoot, SALVAGE_BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(result.ok, true, result.error ?? result.headline);
		assert.ok(result.mergeCommit);

		assert.equal(
			fs.readFileSync(path.join(projectRoot, "tracked.txt"), "utf-8"),
			"operator uncommitted edit\n",
		);
		assert.equal(
			execFileSync("git", ["show", "main:tracked.txt"], { cwd: projectRoot, encoding: "utf-8" }),
			"lane version\n",
		);
		assert.deepEqual(result.warnings, [
			"DirtyOverlap: tracked.txt kept local edits — run git diff / git restore --source main -- tracked.txt after review",
		]);

		const events = readJournalEvents(projectRoot, SALVAGE_BATCH_ID);
		const overlap = events.find((event) => event.type === "integrate.dirty_overlap");
		assert.ok(overlap);
		assert.deepEqual(overlap.payload.skippedDirtyPaths, ["tracked.txt"]);
		// laneNumber is a journal META_KEY: it lands on the event as laneId (journal convention).
		assert.equal(overlap.laneId, "lane-1");
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
