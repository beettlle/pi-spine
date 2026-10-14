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

test("syncPlumbingMergePathsToWorktree removes merge-deleted paths when applyDeletions is opted in (SP-830)", async () => {
	const projectRoot = await initGitRepo("spine-sync-delete-on-");
	try {
		fs.writeFileSync(path.join(projectRoot, "deleted.txt"), "doomed\n", "utf-8");
		execFileSync("git", ["add", "deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-delete"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit, { applyDeletions: true });

		assert.equal(result.ok, true);
		assert.equal(result.processedPaths, 1);
		assert.equal(fs.existsSync(path.join(projectRoot, "deleted.txt")), false);
		assert.equal(execFileSync("git", ["ls-files"], { cwd: projectRoot, encoding: "utf-8" }).includes("deleted.txt"), false);
		const porcelain = execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf-8" }).trim();
		assert.equal(porcelain, "D  deleted.txt");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree keeps merge-deleted paths by default (SP-784 behavior)", async () => {
	const projectRoot = await initGitRepo("spine-sync-delete-off-");
	try {
		fs.writeFileSync(path.join(projectRoot, "deleted.txt"), "kept\n", "utf-8");
		execFileSync("git", ["add", "deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-delete-off"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
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
		assert.equal(result.processedPaths, 0);
		assert.equal(fs.readFileSync(path.join(projectRoot, "deleted.txt"), "utf-8"), "kept\n");
		assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf-8" }).trim(), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncPlumbingMergePathsToWorktree skips operator-touched merge-deleted paths even when applyDeletions is on (SP-830)", async () => {
	const projectRoot = await initGitRepo("spine-sync-delete-dirty-");
	try {
		fs.writeFileSync(path.join(projectRoot, "gone.txt"), "tracked\n", "utf-8");
		execFileSync("git", ["add", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-delete-dirty"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete gone.txt"], { cwd: projectRoot, stdio: "ignore" });
		const mergeCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		const baseSha = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		// Operator has an uncommitted edit on the merge-deleted path.
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

test("syncMergeResultToCheckedOutBase forwards applyDeletions in plumbing mode (SP-830)", async () => {
	const projectRoot = await initGitRepo("spine-sync-delete-fwd-");
	try {
		fs.writeFileSync(path.join(projectRoot, "deleted.txt"), "doomed\n", "utf-8");
		execFileSync("git", ["add", "deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "baseline"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", "-b", "orch/sync-delete-fwd"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["rm", "deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "delete deleted.txt"], { cwd: projectRoot, stdio: "ignore" });
		const orchTip = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		// Plumbing merge commit: first parent is main, tree takes orch's deletion.
		const tree = execFileSync("git", ["rev-parse", `${orchTip}^{tree}`], { cwd: projectRoot, encoding: "utf-8" }).trim();
		const mergeCommit = execFileSync("git", ["commit-tree", tree, "-p", "main", "-p", orchTip, "-m", "plumbing merge"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const result = syncMergeResultToCheckedOutBase(projectRoot, "main", { mode: "plumbing", mergeCommit }, {
			dirtyPaths: [],
		});

		assert.notEqual(result, null);
		assert.equal(result.ok, true);
		assert.equal(fs.existsSync(path.join(projectRoot, "deleted.txt")), false);
		assert.equal(execFileSync("git", ["ls-files"], { cwd: projectRoot, encoding: "utf-8" }).includes("deleted.txt"), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
