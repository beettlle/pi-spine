import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { syncPlumbingMergePathsToWorktree } from "../../src/batch/integrate-worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {{ createBranch?: boolean, branch: string, filePath: string, content: string }} params
 * @returns {string} commit sha
 */
function commitFileOnBranch(projectRoot, { createBranch = false, branch, filePath, content }) {
	if (createBranch) {
		execFileSync("git", ["checkout", "-b", branch], { cwd: projectRoot, stdio: "ignore" });
	} else {
		execFileSync("git", ["checkout", branch], { cwd: projectRoot, stdio: "ignore" });
	}
	fs.mkdirSync(path.dirname(path.join(projectRoot, filePath)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, filePath), content, "utf-8");
	execFileSync("git", ["add", filePath], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", `add ${filePath}`], { cwd: projectRoot, stdio: "ignore" });
	return execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf-8" }).trim();
}

test("syncPlumbingMergePathsToWorktree succeeds when worktree has paths not in HEAD", async () => {
	const projectRoot = await initGitRepo("spine-sync-coverage-");
	try {
		const mergeCommit = commitFileOnBranch(projectRoot, {
			createBranch: true,
			branch: "orch/sync-coverage",
			filePath: "merged.txt",
			content: "merged content\n",
		});
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src/app.mjs\n", "utf-8");

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);

		assert.equal(result.ok, true);
		assert.ok(result.processedPaths >= 1);
		assert.equal(fs.readFileSync(path.join(projectRoot, "merged.txt"), "utf-8"), "merged content\n");
		assert.equal(fs.existsSync(path.join(projectRoot, "coverage", "lcov.info")), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree restores paths that exist in merge commit", async () => {
	const projectRoot = await initGitRepo("spine-sync-restore-");
	try {
		fs.writeFileSync(path.join(projectRoot, "tracked.txt"), "baseline\n", "utf-8");
		execFileSync("git", ["add", "tracked.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-restore"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = commitFileOnBranch(projectRoot, {
			branch: "orch/sync-restore",
			filePath: "tracked.txt",
			content: "updated from orch\n",
		});
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		assert.equal(fs.readFileSync(path.join(projectRoot, "tracked.txt"), "utf-8"), "baseline\n");

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);

		assert.equal(result.ok, true);
		assert.equal(result.processedPaths, 1);
		assert.equal(fs.readFileSync(path.join(projectRoot, "tracked.txt"), "utf-8"), "updated from orch\n");

		const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(staged, "tracked.txt");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree skips diff paths absent from merge commit", async () => {
	const projectRoot = await initGitRepo("spine-sync-skip-missing-");
	try {
		execFileSync("git", ["checkout", "-b", "orch/sync-skip"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "present.txt"), "present\n", "utf-8");
		execFileSync("git", ["add", "present.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add present"], { cwd: projectRoot, stdio: "ignore" });
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
		assert.equal(result.processedPaths, 1);
		assert.equal(fs.readFileSync(path.join(projectRoot, "present.txt"), "utf-8"), "present\n");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
