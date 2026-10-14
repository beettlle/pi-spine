import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { syncMergePathsToCheckedOutBase, syncMergeResultToCheckedOutBase, syncPlumbingMergePathsToWorktree } from "../../src/batch/integrate-worktree.mjs";
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

test("syncPlumbingMergePathsToWorktree skips dirty merged paths and reports skippedDirtyPaths (SP-784)", async () => {
	const projectRoot = await initGitRepo("spine-sync-dirty-skip-");
	try {
		fs.writeFileSync(path.join(projectRoot, "clean.txt"), "clean\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "dirty.txt"), "dirty\n", "utf-8");
		execFileSync("git", ["add", "."], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-dirty"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "clean.txt"), "clean from orch\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "dirty.txt"), "dirty from orch\n", "utf-8");
		execFileSync("git", ["add", "."], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch changes"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		// Operator has an uncommitted edit on one of the merged paths.
		fs.writeFileSync(path.join(projectRoot, "dirty.txt"), "operator edit\n", "utf-8");

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);

		assert.equal(result.ok, true);
		assert.deepEqual(result.skippedDirtyPaths, ["dirty.txt"]);
		assert.equal(result.processedPaths, 1);
		assert.equal(fs.readFileSync(path.join(projectRoot, "clean.txt"), "utf-8"), "clean from orch\n");
		assert.equal(fs.readFileSync(path.join(projectRoot, "dirty.txt"), "utf-8"), "operator edit\n");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncMergePathsToCheckedOutBase returns null and leaves a feature-branch checkout untouched (SP-784)", async () => {
	const projectRoot = await initGitRepo("spine-sync-gate-feature-");
	try {
		fs.writeFileSync(path.join(projectRoot, "clean.txt"), "clean\n", "utf-8");
		execFileSync("git", ["add", "."], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-gate"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "clean.txt"), "clean from orch\n", "utf-8");
		execFileSync("git", ["add", "."], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch changes"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		// Feature branch checked out with an uncommitted edit: base is NOT checked out now.
		execFileSync("git", ["checkout", "-b", "feature/wip"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "wip.txt"), "draft\n", "utf-8");
		const porcelainBefore = execFileSync("git", ["status", "--porcelain"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = syncMergePathsToCheckedOutBase(projectRoot, "main", baseSha, mergeCommit);

		assert.equal(result, null);
		assert.equal(
			execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf-8" }),
			porcelainBefore,
		);
		// feature/wip inherited orch's committed content; the point is the sync never ran.
		assert.equal(fs.readFileSync(path.join(projectRoot, "clean.txt"), "utf-8"), "clean from orch\n");
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

test("syncMergeResultToCheckedOutBase removes a branch-deleted file in fast-forward mode (SP-830)", async () => {
	const projectRoot = await initGitRepo("spine-sync-ff-delete-");
	try {
		fs.writeFileSync(path.join(projectRoot, "gone.txt"), "tracked\n", "utf-8");
		execFileSync("git", ["add", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });
		const baseShaBefore = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		execFileSync("git", ["checkout", "-b", "orch/ff-delete"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		// Integrate moves the base ref by CAS while the checkout still holds the pre-merge state.
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["update-ref", "refs/heads/main", mergeCommit], { cwd: projectRoot, stdio: "ignore" });

		const result = syncMergeResultToCheckedOutBase(
			projectRoot,
			"main",
			{ mode: "fast-forward", baseShaBefore, mergeCommit },
			{},
		);

		assert.equal(result.ok, true);
		assert.equal(fs.existsSync(path.join(projectRoot, "gone.txt")), false);
		assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf-8" }), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree untracks a deleted gitlink but keeps its directory (SP-830)", async () => {
	const projectRoot = await initGitRepo("spine-sync-gitlink-delete-");
	try {
		fs.writeFileSync(path.join(projectRoot, "base.txt"), "base\n", "utf-8");
		execFileSync("git", ["add", "base.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.join(projectRoot, "sub"), { recursive: true });
		const gitlinkSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["update-index", "--add", "--cacheinfo", `160000,${gitlinkSha},sub`], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		execFileSync("git", ["commit", "-m", "add gitlink sub"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		execFileSync("git", ["checkout", "-b", "orch/gitlink-delete"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "--cached", "sub"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete gitlink sub"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["update-ref", "refs/heads/main", mergeCommit], { cwd: projectRoot, stdio: "ignore" });

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit, { applyDeletions: true });

		assert.equal(result.ok, true);
		assert.equal(result.processedPaths, 1);
		assert.equal(execFileSync("git", ["ls-files"], { cwd: projectRoot, encoding: "utf-8" }).includes("sub"), false);
		assert.equal(fs.existsSync(path.join(projectRoot, "sub")), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree keeps an operator-edited deleted path in skippedDirtyPaths (SP-830)", async () => {
	const projectRoot = await initGitRepo("spine-sync-delete-dirty-");
	try {
		fs.writeFileSync(path.join(projectRoot, "gone.txt"), "tracked\n", "utf-8");
		execFileSync("git", ["add", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		execFileSync("git", ["checkout", "-b", "orch/delete-dirty"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["update-ref", "refs/heads/main", mergeCommit], { cwd: projectRoot, stdio: "ignore" });
		// Operator edits the merge-deleted path before the sync runs.
		fs.writeFileSync(path.join(projectRoot, "gone.txt"), "operator edit\n", "utf-8");

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit, {
			applyDeletions: true,
			dirtyPaths: ["gone.txt"],
		});

		assert.equal(result.ok, true);
		assert.deepEqual(result.skippedDirtyPaths, ["gone.txt"]);
		assert.equal(result.processedPaths, 0);
		assert.equal(fs.readFileSync(path.join(projectRoot, "gone.txt"), "utf-8"), "operator edit\n");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree keeps a deleted file in the index without applyDeletions (sync-base behavior)", async () => {
	const projectRoot = await initGitRepo("spine-sync-delete-off-");
	try {
		fs.writeFileSync(path.join(projectRoot, "gone.txt"), "tracked\n", "utf-8");
		execFileSync("git", ["add", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		execFileSync("git", ["checkout", "-b", "orch/delete-off"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["update-ref", "refs/heads/main", mergeCommit], { cwd: projectRoot, stdio: "ignore" });

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);

		assert.equal(result.ok, true);
		assert.equal(result.processedPaths, 0);
		assert.equal(execFileSync("git", ["ls-files"], { cwd: projectRoot, encoding: "utf-8" }).includes("gone.txt"), true);
		assert.equal(fs.readFileSync(path.join(projectRoot, "gone.txt"), "utf-8"), "tracked\n");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
