import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	classifyGitignoredPaths,
	formatGitignoredRemediationMessage,
} from "../../src/batch/lane-dirty-check.mjs";
import { commitLaneWorktree } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function forceAdd(projectRoot, filePath) {
	execFileSync("git", ["add", "-f", "--", filePath], { cwd: projectRoot, stdio: "ignore" });
}

test("classifyGitignoredPaths returns empty arrays for empty input", async () => {
	const projectRoot = await initGitRepo("spine-classify-empty-");
	try {
		const result = classifyGitignoredPaths(projectRoot, []);
		assert.deepEqual(result, { indexTracked: [], worktreeOnly: [] });
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("classifyGitignoredPaths detects index-tracked gitignored paths", async () => {
	const projectRoot = await initGitRepo("spine-classify-indexed-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "add gitignore");

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		forceAdd(projectRoot, "coverage/lcov.info");
		execCommit(projectRoot, "force-add coverage to index");

		const result = classifyGitignoredPaths(projectRoot, ["coverage/lcov.info"]);
		assert.deepEqual(result.indexTracked, ["coverage/lcov.info"]);
		assert.deepEqual(result.worktreeOnly, []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("classifyGitignoredPaths detects worktree-only gitignored paths", async () => {
	const projectRoot = await initGitRepo("spine-classify-worktree-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "add gitignore");

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src\n", "utf-8");

		const result = classifyGitignoredPaths(projectRoot, ["coverage/lcov.info"]);
		assert.deepEqual(result.indexTracked, []);
		assert.deepEqual(result.worktreeOnly, ["coverage/lcov.info"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("classifyGitignoredPaths handles mixed index-tracked and worktree-only", async () => {
	const projectRoot = await initGitRepo("spine-classify-mixed-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\nnode_modules/\n", "utf-8");
		execCommit(projectRoot, "add gitignore");

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		forceAdd(projectRoot, "coverage/lcov.info");
		execCommit(projectRoot, "force-add coverage to index");

		fs.mkdirSync(path.join(projectRoot, "node_modules", "pkg"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "node_modules", "pkg", "index.js"), "module.exports = {};\n", "utf-8");

		const result = classifyGitignoredPaths(projectRoot, [
			"coverage/lcov.info",
			"node_modules/pkg/index.js",
		]);
		assert.deepEqual(result.indexTracked, ["coverage/lcov.info"]);
		assert.deepEqual(result.worktreeOnly, ["node_modules/pkg/index.js"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("formatGitignoredRemediationMessage: worktree-only does not suggest git rm --cached", () => {
	const message = formatGitignoredRemediationMessage([], ["coverage/lcov.info"]);
	assert.doesNotMatch(message, /git rm --cached/);
	assert.match(message, /worktree-only/);
	assert.match(message, /git clean -fdX/);
});

test("formatGitignoredRemediationMessage: index-tracked suggests git rm --cached", () => {
	const message = formatGitignoredRemediationMessage(["coverage/lcov.info"], []);
	assert.match(message, /git rm --cached/);
	assert.doesNotMatch(message, /worktree-only/);
});

test("formatGitignoredRemediationMessage: mixed suggests both remediation paths", () => {
	const message = formatGitignoredRemediationMessage(
		["coverage/lcov.info"],
		["node_modules/pkg/index.js"],
	);
	assert.match(message, /git rm --cached/);
	assert.match(message, /git clean -fdX/);
});

test("commitLaneWorktree: worktree-only gitignored does not suggest git rm --cached", async () => {
	const projectRoot = await initGitRepo("spine-commit-worktree-only-");
	try {
		const batchId = "20260703T120000";
		const taskId = "SP-470";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		// Commit .DONE first so only gitignored files remain dirty.
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task done");

		// Now create worktree-only gitignored artifacts (never in index).
		fs.mkdirSync(path.join(worktreePath, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "coverage", "lcov.info"), "SF:src\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "GitignoredDirtyWorktree");
		assert.doesNotMatch(result.error, /git rm --cached/);
		assert.match(result.error, /worktree-only/);
		assert.match(result.error, /git clean -fdX/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree: index-tracked gitignored still suggests git rm --cached", async () => {
	const projectRoot = await initGitRepo("spine-commit-index-tracked-");
	try {
		const batchId = "20260703T120001";
		const taskId = "SP-470";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

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
		fs.mkdirSync(path.join(worktreePath, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		forceAdd(worktreePath, "coverage/lcov.info");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execFileSync("git", ["add", "--", "spine-tasks"], { cwd: worktreePath, stdio: "ignore" });
		execCommit(worktreePath, "seed tracked gitignored and task");

		fs.writeFileSync(path.join(worktreePath, "coverage", "lcov.info"), "SF:changed\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "GitignoredDirtyWorktree");
		assert.match(result.error, /git rm --cached/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

// Regression: batch 20260702T061256 SP-011 scenario — worktree-only gitignored
// coverage from npm test falsely suggested git rm --cached.
test("regression: SP-011 worktree-only coverage after npm test does not suggest git rm --cached", async () => {
	const projectRoot = await initGitRepo("spine-regress-sp011-");
	try {
		const batchId = "20260702T061256";
		const taskId = "SP-011";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.writeFileSync(
			path.join(projectRoot, ".gitignore"),
			"coverage/\nextension/coverage/\nnode_modules/\n",
			"utf-8",
		);
		execCommit(projectRoot, "gitignore");

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		// Commit .DONE first so only gitignored artifacts remain.
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task done");

		// Simulate npm test generating coverage artifacts (worktree-only, never in index).
		const covDir = path.join(worktreePath, "coverage");
		fs.mkdirSync(covDir, { recursive: true });
		fs.writeFileSync(path.join(covDir, "lcov.info"), "TN:\nSF:src/app.mjs\nend_of_record\n", "utf-8");
		fs.writeFileSync(path.join(covDir, "coverage-summary.json"), "{}\n", "utf-8");

		const classified = classifyGitignoredPaths(worktreePath, [
			"coverage/lcov.info",
			"coverage/coverage-summary.json",
		]);
		assert.equal(classified.indexTracked.length, 0, "coverage should not be in index");
		assert.equal(classified.worktreeOnly.length, 2, "coverage should be worktree-only");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "GitignoredDirtyWorktree");
		assert.doesNotMatch(result.error, /git rm --cached/);
		assert.match(result.error, /worktree-only/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
