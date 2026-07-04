import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { completeBatch, dismissBatch } from "../../src/batch/lifecycle.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	laneTaskBranch,
	laneWorktreePath,
	provisionLaneWorktree,
} from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function _writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {object} fixture
 */
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

test("completeBatch removes lane worktrees and journals batch.worktrees_cleaned", async () => {
	const projectRoot = await initGitRepo("spine-wt-cleanup-complete-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const batchId = fixture.batchId;
		const orchBranch = fixture.orchBranch;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const worktreePath = laneWorktreePath(projectRoot, batchId, 1);
		assert.ok(fs.existsSync(worktreePath));

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

		const result = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(result.ok, true);
		assert.ok(!fs.existsSync(worktreePath), "complete should remove lane worktree");

		const events = readJournalEvents(projectRoot, batchId);
		const cleaned = events.find((event) => event.type === "batch.worktrees_cleaned");
		assert.ok(cleaned, "batch.worktrees_cleaned journal event expected");
		assert.equal(cleaned.payload?.batchId, batchId);
		assert.equal(cleaned.payload?.laneCount, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dismissBatch removes lane worktrees and journals batch.worktrees_cleaned", async () => {
	const projectRoot = await initGitRepo("spine-wt-cleanup-dismiss-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const batchId = fixture.batchId;
		const orchBranch = fixture.orchBranch;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const worktreePath = laneWorktreePath(projectRoot, batchId, 1);
		assert.ok(fs.existsSync(worktreePath));

		writePiBatchState(projectRoot, withLaneState(projectRoot, fixture));

		const result = dismissBatch({ projectRoot, reason: "test cleanup" });
		assert.equal(result.ok, true);
		assert.ok(!fs.existsSync(worktreePath), "dismiss should remove lane worktree");

		const events = readJournalEvents(projectRoot, batchId);
		const cleaned = events.find((event) => event.type === "batch.worktrees_cleaned");
		assert.ok(cleaned, "batch.worktrees_cleaned journal event expected");
		assert.equal(cleaned.payload?.batchId, batchId);
		assert.equal(cleaned.payload?.laneCount, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch keeps worktree when cleanupWorktreesOnComplete is false", async () => {
	const projectRoot = await initGitRepo("spine-wt-cleanup-disabled-");
	try {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.lanes = { ...config.lanes, cleanupWorktreesOnComplete: false };
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		const batchId = fixture.batchId;
		const orchBranch = fixture.orchBranch;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const worktreePath = laneWorktreePath(projectRoot, batchId, 1);

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

		const result = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(result.ok, true);
		assert.ok(fs.existsSync(worktreePath), "worktree kept when cleanup disabled");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(
			!events.some((event) => event.type === "batch.worktrees_cleaned"),
			"no cleanup journal when disabled",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
