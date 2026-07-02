import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { commitLaneAndValidateWorktree } from "../../src/batch/engine-lanes/commit.mjs";
import {
	filterOutOfScopeCoveragePorcelain,
	isCoverageArtifactPath,
	isPathInFileScope,
	resolvePostLaneCommitPorcelain,
	restoreOutOfScopeCoverageArtifacts,
} from "../../src/batch/lane-dirty-check.mjs";
import { gitPorcelain } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
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

test("isCoverageArtifactPath matches extension/coverage and root coverage dirs", () => {
	assert.equal(isCoverageArtifactPath("extension/coverage/lcov.info"), true);
	assert.equal(isCoverageArtifactPath("coverage/index.html"), true);
	assert.equal(isCoverageArtifactPath("src/app.mjs"), false);
});

test("isPathInFileScope matches exact paths and directory prefixes", () => {
	const scope = ["src/app.mjs", "extension/coverage/"];
	assert.equal(isPathInFileScope("src/app.mjs", scope), true);
	assert.equal(isPathInFileScope("extension/coverage/lcov.info", scope), true);
	assert.equal(isPathInFileScope("docs/readme.md", scope), false);
});

test("filterOutOfScopeCoveragePorcelain drops modified coverage outside file scope", () => {
	const porcelain = [
		" M extension/coverage/lcov.info",
		" M src/app.mjs",
	].join("\n");
	const filtered = filterOutOfScopeCoveragePorcelain(porcelain, ["src/app.mjs"]);
	assert.equal(filtered, " M src/app.mjs");
});

test("filterOutOfScopeCoveragePorcelain keeps in-scope coverage modifications", () => {
	const porcelain = " M extension/coverage/lcov.info";
	const filtered = filterOutOfScopeCoveragePorcelain(porcelain, ["extension/coverage/lcov.info"]);
	assert.equal(filtered, porcelain);
});

test("restoreOutOfScopeCoverageArtifacts resets tracked coverage files", async () => {
	const projectRoot = await initGitRepo("spine-coverage-restore-");
	try {
		const coverageDir = path.join(projectRoot, "extension", "coverage");
		fs.mkdirSync(coverageDir, { recursive: true });
		fs.writeFileSync(path.join(coverageDir, "lcov.info"), "SF:src/app.mjs\nend_of_record\n", "utf-8");
		execCommit(projectRoot, "commit coverage artifacts");

		fs.writeFileSync(path.join(coverageDir, "lcov.info"), "SF:src/changed.mjs\nend_of_record\n", "utf-8");
		const porcelainBefore = gitPorcelain(projectRoot);
		assert.match(porcelainBefore, /extension\/coverage\/lcov\.info/);

		const { restored } = restoreOutOfScopeCoverageArtifacts(
			projectRoot,
			["src/app.mjs"],
			{ dirtyPaths: ["extension/coverage/lcov.info"] },
		);
		assert.deepEqual(restored, ["extension/coverage/lcov.info"]);
		assert.equal(gitPorcelain(projectRoot), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolvePostLaneCommitPorcelain restores and filters out-of-scope coverage", async () => {
	const projectRoot = await initGitRepo("spine-coverage-resolve-");
	try {
		const coverageDir = path.join(projectRoot, "extension", "coverage");
		fs.mkdirSync(coverageDir, { recursive: true });
		fs.writeFileSync(path.join(coverageDir, "index.html"), "<html>baseline</html>", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "src.txt"), "tracked\n", "utf-8");
		execCommit(projectRoot, "commit baseline");

		fs.writeFileSync(path.join(coverageDir, "index.html"), "<html>regenerated</html>", "utf-8");
		const porcelain = gitPorcelain(projectRoot);
		const resolved = resolvePostLaneCommitPorcelain(projectRoot, {
			fileScopePaths: ["src.txt"],
			porcelain,
		});
		assert.equal(resolved, "");
		assert.equal(gitPorcelain(projectRoot), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneAndValidateWorktree succeeds when only out-of-scope coverage is dirty", async () => {
	const projectRoot = await initGitRepo("spine-coverage-commit-gate-");
	try {
		const batchId = "20260702T150000";
		const taskId = "SP-427";
		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);
		fs.mkdirSync(taskFolder, { recursive: true });

		const coverageDir = path.join(worktreePath, "extension", "coverage");
		fs.mkdirSync(coverageDir, { recursive: true });
		fs.writeFileSync(path.join(coverageDir, "lcov.info"), "SF:src/app.mjs\nend_of_record\n", "utf-8");
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task and coverage baseline");

		fs.writeFileSync(path.join(coverageDir, "lcov.info"), "SF:src/regenerated.mjs\nend_of_record\n", "utf-8");
		fs.writeFileSync(path.join(coverageDir, "index.html"), "<html>regenerated</html>", "utf-8");

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

test("commitLaneAndValidateWorktree fails when dirty without .DONE", async () => {
	const projectRoot = await initGitRepo("spine-coverage-no-done-");
	try {
		const batchId = "20260702T150001";
		const taskId = "SP-427";
		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);
		fs.mkdirSync(taskFolder, { recursive: true });

		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");

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

		assert.equal(result.ok, false);
		assert.equal(result.error, "lane_commit_failed");
		assert.equal(task.exitReason, "DirtyWorktree");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
