import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { commitLaneWorktree } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("commitLaneWorktree commits dirty worktree when .DONE exists", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-");
	try {
		const batchId = "20260601T150000";
		const taskId = "TP-999";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "taskplane-tasks", `${taskId}-smoke`);

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");

		const before = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, true);
		assert.ok(result.commitSha);

		const after = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.notEqual(before, after);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree fails loud when dirty without .DONE", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-dirty-");
	try {
		const batchId = "20260601T150001";
		const taskId = "TP-999";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "taskplane-tasks", `${taskId}-smoke`);

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "DirtyWorktree");
		assert.match(result.error, /\.DONE is missing/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
