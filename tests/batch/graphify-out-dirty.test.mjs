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

test("isGitignoredArtifactPath matches graphify-out hook output", () => {
	assert.equal(isGitignoredArtifactPath("graphify-out/.graphify_labels.json"), true);
	assert.equal(isGitignoredArtifactPath("graphify-out/cache/stat-index.json"), true);
	assert.equal(isGitignoredArtifactPath("graphify-out/.pending_changes"), true);
	assert.equal(isGitignoredArtifactPath("src/app.mjs"), false);
});

test("listGitignoredArtifactRoots deduplicates nested graphify-out paths", () => {
	const roots = listGitignoredArtifactRoots([
		"graphify-out/.graphify_labels.json",
		"graphify-out/cache/stat-index.json",
		"graphify-out/.pending_changes",
	]);
	assert.deepEqual(roots, ["graphify-out"]);
});

test("sanitizeGitignoredArtifactsBeforeLaneCommit removes worktree-only graphify-out", async () => {
	const projectRoot = await initGitRepo("spine-graphify-out-clean-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "graphify-out/\n", "utf-8");
		execCommit(projectRoot, "gitignore graphify-out");

		const graphifyDir = path.join(projectRoot, "graphify-out", "cache");
		fs.mkdirSync(graphifyDir, { recursive: true });
		fs.writeFileSync(path.join(graphifyDir, "stat-index.json"), "{}\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "graphify-out", ".pending_changes"), "1\n", "utf-8");

		const { cleanedRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(projectRoot, {
			porcelain: gitPorcelain(projectRoot),
		});
		assert.deepEqual(cleanedRoots, ["graphify-out"]);
		assert.equal(gitPorcelain(projectRoot), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneAndValidateWorktree succeeds when only graphify-out is gitignored dirty", async () => {
	const projectRoot = await initGitRepo("spine-graphify-out-lane-");
	try {
		const batchId = "20260705T032132";
		const taskId = "SP-463";

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "graphify-out/\n", "utf-8");
		execCommit(projectRoot, "gitignore graphify-out");

		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task work");

		const graphifyDir = path.join(worktreePath, "graphify-out", "cache", "ast", "v0.9.4");
		fs.mkdirSync(graphifyDir, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "graphify-out", ".graphify_labels.json"), "{}\n", "utf-8");
		fs.writeFileSync(path.join(worktreePath, "graphify-out", ".pending_changes"), "1\n", "utf-8");
		fs.writeFileSync(path.join(graphifyDir, "abc123.json"), "{}\n", "utf-8");

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
