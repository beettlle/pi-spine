import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { commitLaneAndValidateWorktree } from "../../src/batch/engine-lanes/commit.mjs";
import {
	isGitignoredArtifactPath,
	listGitignoredArtifactRoots,
	sanitizeGitignoredArtifactsBeforeLaneCommit,
} from "../../src/batch/lane-dirty-check.mjs";
import { commitLaneWorktree, gitPorcelain } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function forceAdd(projectRoot, filePath) {
	execFileSync("git", ["add", "-f", "--", filePath], { cwd: projectRoot, stdio: "ignore" });
}

function createLaneWorktree(projectRoot, batchId) {
	const taskBranch = `task/spine-lane-1-${batchId}`;
	const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
	execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
	execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	return { worktreePath, taskBranch };
}

test("isGitignoredArtifactPath matches extension/coverage and node_modules", () => {
	assert.equal(isGitignoredArtifactPath("extension/coverage/lcov.info"), true);
	assert.equal(isGitignoredArtifactPath("extension/node_modules/pkg/index.js"), true);
	assert.equal(isGitignoredArtifactPath("node_modules/pkg/index.js"), true);
	assert.equal(isGitignoredArtifactPath("src/app.mjs"), false);
});

test("listGitignoredArtifactRoots deduplicates nested artifact dirs", () => {
	const roots = listGitignoredArtifactRoots([
		"extension/coverage/lcov.info",
		"extension/coverage/index.html",
		"extension/node_modules/pkg/index.js",
	]);
	assert.deepEqual(roots, ["extension/coverage", "extension/node_modules"]);
});

test("sanitizeGitignoredArtifactsBeforeLaneCommit removes worktree-only coverage", async () => {
	const projectRoot = await initGitRepo("spine-gitignored-clean-coverage-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src\n", "utf-8");

		const { cleanedRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(projectRoot, {
			porcelain: gitPorcelain(projectRoot),
		});
		assert.deepEqual(cleanedRoots, ["coverage"]);
		assert.equal(gitPorcelain(projectRoot), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("sanitizeGitignoredArtifactsBeforeLaneCommit skips when disabled", async () => {
	const projectRoot = await initGitRepo("spine-gitignored-clean-disabled-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		assert.ok(fs.existsSync(path.join(projectRoot, "coverage", "lcov.info")));

		const { cleanedRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(projectRoot, {
			porcelain: gitPorcelain(projectRoot),
			enabled: false,
		});
		assert.deepEqual(cleanedRoots, []);
		assert.ok(fs.existsSync(path.join(projectRoot, "coverage", "lcov.info")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneAndValidateWorktree succeeds when only extension/coverage is gitignored dirty", async () => {
	const projectRoot = await initGitRepo("spine-auto-clean-extension-coverage-");
	try {
		const batchId = "20260704T120000";
		const taskId = "SP-471";

		fs.writeFileSync(
			path.join(projectRoot, ".gitignore"),
			"coverage/\nextension/coverage/\n",
			"utf-8",
		);
		execCommit(projectRoot, "gitignore");

		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task work");

		const covDir = path.join(worktreePath, "extension", "coverage");
		fs.mkdirSync(covDir, { recursive: true });
		fs.writeFileSync(path.join(covDir, "lcov.info"), "SF:src\nend_of_record\n", "utf-8");
		fs.writeFileSync(path.join(covDir, "index.html"), "<html>report</html>", "utf-8");

		const task = { taskId, status: "running" };
		const lane = { laneId: "lane-1", laneNumber: 1 };
		const state = { tasks: [task], lanes: [lane] };
		const result = commitLaneAndValidateWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
			projectRoot,
			fileScopePaths: ["lane-change.txt"],
			ignorePatterns: [],
			task,
			lane,
			laneNumber: 1,
			laneCorrelationId: "corr-1",
			state,
			config: {},
		});

		assert.equal(result.ok, true);
		assert.equal(result.laneCommit.committed, false);
		assert.equal(gitPorcelain(worktreePath), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneAndValidateWorktree succeeds when only node_modules is gitignored dirty", async () => {
	const projectRoot = await initGitRepo("spine-auto-clean-node-modules-");
	try {
		const batchId = "20260704T120001";
		const taskId = "SP-471";

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "node_modules/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task work");

		const pkgDir = path.join(worktreePath, "node_modules", "pkg");
		fs.mkdirSync(pkgDir, { recursive: true });
		fs.writeFileSync(path.join(pkgDir, "index.js"), "module.exports = {};\n", "utf-8");

		const task = { taskId, status: "running" };
		const lane = { laneId: "lane-1", laneNumber: 1 };
		const state = { tasks: [task], lanes: [lane] };
		const result = commitLaneAndValidateWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
			projectRoot,
			fileScopePaths: ["lane-change.txt"],
			ignorePatterns: [],
			task,
			lane,
			laneNumber: 1,
			laneCorrelationId: "corr-1",
			state,
			config: {},
		});

		assert.equal(result.ok, true);
		assert.equal(result.laneCommit.committed, false);
		assert.equal(gitPorcelain(worktreePath), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("sanitizeGitignoredArtifactsBeforeLaneCommit does not clean index-tracked gitignored paths", async () => {
	const projectRoot = await initGitRepo("spine-auto-clean-index-tracked-sanitize-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		forceAdd(projectRoot, "coverage/lcov.info");
		execCommit(projectRoot, "seed tracked gitignored coverage");

		fs.writeFileSync(path.join(projectRoot, "coverage", "lcov.info"), "SF:changed\n", "utf-8");

		const { cleanedRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(projectRoot, {
			porcelain: gitPorcelain(projectRoot),
		});
		assert.deepEqual(cleanedRoots, []);
		assert.match(gitPorcelain(projectRoot), /coverage\/lcov\.info/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree still fails for index-tracked gitignored coverage", async () => {
	const projectRoot = await initGitRepo("spine-auto-clean-index-tracked-");
	try {
		const batchId = "20260704T120002";
		const taskId = "SP-471";

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

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
