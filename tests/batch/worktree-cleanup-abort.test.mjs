import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { abortBatch } from "../../src/batch/abort.mjs";
import { completeBatch, dismissBatch } from "../../src/batch/lifecycle.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import {
	batchWorktreeDir,
	laneTaskBranch,
	laneWorktreePath,
	pruneStaleWorktrees,
	provisionLaneWorktree,
	removeEmptyBatchWorktreeDir,
	scanStaleWorktrees,
} from "../../src/batch/worktree.mjs";
import { runSpineCleanup } from "../../bin/spine-cleanup.mjs";
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

function withLaneState(projectRoot, fixture) {
	const batchId = String(fixture.batchId ?? fixture.id ?? "");
	return {
		...fixture,
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: fixture.tasks?.map((task) => task.taskId) ?? [],
			},
		],
	};
}

function writeRunningBatch(projectRoot, batchId) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [["TP-999"]],
		tasks: [
			{
				taskId: "TP-999",
				laneNumber: 1,
				status: "running",
				taskFolder: "spine-tasks/TP-999-smoke",
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: ["TP-999"],
				lastHeartbeatAt: null,
				workerPid: 999999,
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return state;
}

test("hard abort removes lane worktree, empty shell, and journals batch.worktrees_cleaned", async () => {
	const projectRoot = await initGitRepo("spine-wt-cleanup-abort-");
	try {
		const batchId = "20260601T170010";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

		writeRunningBatch(projectRoot, batchId);
		const worktreePath = laneWorktreePath(projectRoot, batchId, 1);
		const batchDir = batchWorktreeDir(projectRoot, batchId);
		assert.ok(fs.existsSync(worktreePath));
		assert.ok(fs.existsSync(batchDir));

		const result = abortBatch({ projectRoot, hard: true });
		assert.equal(result.ok, true);
		assert.ok(!fs.existsSync(worktreePath), "hard abort should remove lane worktree");
		assert.ok(!fs.existsSync(batchDir), "hard abort should remove empty batch shell");

		const events = readJournalEvents(projectRoot, batchId);
		const cleaned = events.find((event) => event.type === "batch.worktrees_cleaned");
		assert.ok(cleaned, "batch.worktrees_cleaned journal event expected");
		assert.equal(cleaned.payload?.batchId, batchId);
		assert.equal(cleaned.payload?.laneCount, 1);
		assert.equal(cleaned.payload?.reason, "hard_abort");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch removes empty batch shell after lane cleanup", async () => {
	const projectRoot = await initGitRepo("spine-wt-cleanup-complete-shell-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const batchId = fixture.batchId;
		const orchBranch = fixture.orchBranch;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		writePiBatchState(projectRoot, withLaneState(projectRoot, fixture));

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const batchDir = batchWorktreeDir(projectRoot, batchId);
		const result = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(result.ok, true);
		assert.ok(!fs.existsSync(batchDir), "complete should remove empty batch shell");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dismissBatch removes empty batch shell after lane cleanup", async () => {
	const projectRoot = await initGitRepo("spine-wt-cleanup-dismiss-shell-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const batchId = fixture.batchId;
		const orchBranch = fixture.orchBranch;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		writePiBatchState(projectRoot, withLaneState(projectRoot, fixture));

		const batchDir = batchWorktreeDir(projectRoot, batchId);
		const result = dismissBatch({ projectRoot, reason: "test cleanup" });
		assert.equal(result.ok, true);
		assert.ok(!fs.existsSync(batchDir), "dismiss should remove empty batch shell");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("removeEmptyBatchWorktreeDir removes only empty batch shells", async () => {
	const projectRoot = await initGitRepo("spine-wt-empty-shell-");
	try {
		const batchId = "20260601T170011";
		const batchDir = batchWorktreeDir(projectRoot, batchId);
		fs.mkdirSync(batchDir, { recursive: true });
		assert.equal(removeEmptyBatchWorktreeDir(projectRoot, batchId), true);
		assert.ok(!fs.existsSync(batchDir));

		fs.mkdirSync(path.join(batchDir, "lane-1"), { recursive: true });
		assert.equal(removeEmptyBatchWorktreeDir(projectRoot, batchId), false);
		assert.ok(fs.existsSync(batchDir));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("scanStaleWorktrees lists stale batch dirs and empty shells", async () => {
	const projectRoot = await initGitRepo("spine-wt-scan-stale-");
	try {
		fs.mkdirSync(batchWorktreeDir(projectRoot, "20260630T100000"), { recursive: true });
		fs.mkdirSync(path.join(batchWorktreeDir(projectRoot, "20260630T110000"), "lane-1"), {
			recursive: true,
		});

		const scan = scanStaleWorktrees(projectRoot, "20260630T120000");
		assert.deepEqual(scan.batchIds, ["20260630T100000", "20260630T110000"]);
		assert.deepEqual(scan.emptyShells, ["20260630T100000"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineCleanup worktrees --dry-run lists stale dirs", async () => {
	const projectRoot = await initGitRepo("spine-wt-cli-dryrun-");
	try {
		fs.mkdirSync(batchWorktreeDir(projectRoot, "20260630T100000"), { recursive: true });

		const result = runSpineCleanup({ projectRoot, args: ["worktrees", "--dry-run"] });
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /spine-20260630T100000/);
		assert.match(result.output, /empty shell/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineCleanup worktrees --yes removes empty shells and prunes worktrees", async () => {
	const projectRoot = await initGitRepo("spine-wt-cli-yes-");
	try {
		fs.mkdirSync(batchWorktreeDir(projectRoot, "20260630T100000"), { recursive: true });
		assert.ok(fs.existsSync(batchWorktreeDir(projectRoot, "20260630T100000")));

		const result = runSpineCleanup({ projectRoot, args: ["worktrees", "--yes"] });
		assert.equal(result.exitCode, 0);
		assert.ok(!fs.existsSync(batchWorktreeDir(projectRoot, "20260630T100000")));
		assert.match(result.output, /Removed empty batch shells/);

		const pruned = pruneStaleWorktrees(projectRoot, { dryRun: false });
		assert.deepEqual(pruned.removedShells, []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
