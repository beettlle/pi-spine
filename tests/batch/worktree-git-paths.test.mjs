import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateMultiTaskResume } from "../../src/batch/resume-multi.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import {
	assertLaneWorktreeGitHealthy,
	laneTaskBranch,
	normalizeLaneWorktreeGitPaths,
	provisionLaneWorktree,
	repairLaneWorktreeGitMetadata,
} from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 */
function readLaneGitMetadata(projectRoot, batchId, laneNumber) {
	const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, `lane-${laneNumber}`);
	const laneGit = fs.readFileSync(path.join(worktreePath, ".git"), "utf-8").trim();
	const adminGitdir = fs
		.readFileSync(path.join(projectRoot, ".git", "worktrees", `lane-${laneNumber}`, "gitdir"), "utf-8")
		.trim();
	return { worktreePath, laneGit, adminGitdir };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 */
function breakLaneGitMetadata(projectRoot, batchId, laneNumber) {
	const { worktreePath } = readLaneGitMetadata(projectRoot, batchId, laneNumber);
	fs.writeFileSync(path.join(worktreePath, ".git"), "gitdir: /workspace/.git/worktrees/lane-1\n", "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, ".git", "worktrees", `lane-${laneNumber}`, "gitdir"),
		"/workspace/.worktrees/spine-test/lane-1/.git\n",
		"utf-8",
	);
}

test("provisionLaneWorktree normalizes git metadata to relative posix paths", async () => {
	const projectRoot = await initGitRepo("spine-wt-git-prov-");
	try {
		const batchId = "20260605T160800";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const { laneGit, adminGitdir } = readLaneGitMetadata(projectRoot, batchId, 1);
		assert.match(laneGit, /^gitdir: \.\.\/\.\.\/\.\.\/\.git\/worktrees\/lane-1$/);
		assert.match(adminGitdir, /^\.\.\/\.worktrees\/spine-20260605T160800\/lane-1\/\.git$/);
		assert.doesNotMatch(laneGit, /\/workspace/);
		assert.doesNotMatch(adminGitdir, /\/workspace/);
		assert.doesNotMatch(laneGit, /^gitdir: \//);
		assert.doesNotMatch(adminGitdir, /^\//);

		execFileSync("git", ["status", "--porcelain"], { cwd: worktreePath, stdio: "ignore" });
		assertLaneWorktreeGitHealthy(worktreePath);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("repairLaneWorktreeGitMetadata fixes broken absolute gitdir pointers", async () => {
	const projectRoot = await initGitRepo("spine-wt-git-repair-");
	try {
		const batchId = "20260605T160801";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		breakLaneGitMetadata(projectRoot, batchId, 1);
		assert.throws(() => assertLaneWorktreeGitHealthy(worktreePath), /unhealthy/);

		repairLaneWorktreeGitMetadata({ projectRoot, worktreePath, laneNumber: 1 });
		assertLaneWorktreeGitHealthy(worktreePath);

		const { laneGit, adminGitdir } = readLaneGitMetadata(projectRoot, batchId, 1);
		assert.doesNotMatch(laneGit, /\/workspace/);
		assert.doesNotMatch(adminGitdir, /\/workspace/);

		repairLaneWorktreeGitMetadata({ projectRoot, worktreePath, laneNumber: 1 });
		assert.equal(laneGit, fs.readFileSync(path.join(worktreePath, ".git"), "utf-8").trim());
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("normalizeLaneWorktreeGitPaths is idempotent", async () => {
	const projectRoot = await initGitRepo("spine-wt-git-idem-");
	try {
		const batchId = "20260605T160802";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const before = readLaneGitMetadata(projectRoot, batchId, 1);
		normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath, laneNumber: 1 });
		const after = readLaneGitMetadata(projectRoot, batchId, 1);
		assert.equal(after.laneGit, before.laneGit);
		assert.equal(after.adminGitdir, before.adminGitdir);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume repairs unhealthy lane worktree git metadata", async () => {
	const projectRoot = await initGitRepo("spine-wt-git-resume-");
	try {
		const batchId = "20260605T160803";
		const taskId = "TP-101";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});
		breakLaneGitMetadata(projectRoot, batchId, 1);

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${taskId}-smoke`,
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
					worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = validateMultiTaskResume({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);
		assertLaneWorktreeGitHealthy(worktreePath);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
