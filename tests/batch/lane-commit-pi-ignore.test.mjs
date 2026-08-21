import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	commitLaneWorktree,
	filterPorcelain,
} from "../../src/batch/lane-commit.mjs";
import {
	DEFAULT_WORKTREE_SETUP_IGNORE_PATHS,
	resolveWorktreeSetupIgnorePaths,
} from "../../src/config/spine-config-load.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * `initGitRepo` runs `spine init`, which gitignores `.pi/` (SP-652). Strip that entry so the
 * fixture behaves like a legacy consumer repo where pi session trees are NOT gitignored and
 * would otherwise land in lane commits (#255).
 *
 * @param {string} projectRoot
 */
function unignorePiRuntimeTrees(projectRoot) {
	const gitignorePath = path.join(projectRoot, ".gitignore");
	const lines = fs
		.readFileSync(gitignorePath, "utf-8")
		.split("\n")
		.filter((line) => line.trim() !== ".pi/");
	fs.writeFileSync(gitignorePath, lines.join("\n"), "utf-8");
	execFileSync("git", ["add", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "drop .pi gitignore entry (legacy repo)"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
}

test("DEFAULT_WORKTREE_SETUP_IGNORE_PATHS includes pi agent runtime dirs (SP-711 / #255)", () => {
	assert.ok(DEFAULT_WORKTREE_SETUP_IGNORE_PATHS.includes(".venv"));
	assert.ok(DEFAULT_WORKTREE_SETUP_IGNORE_PATHS.includes(".pi"));
	assert.ok(DEFAULT_WORKTREE_SETUP_IGNORE_PATHS.includes(".pi-smart-router"));
});

test("resolveWorktreeSetupIgnorePaths unions pi runtime dirs with config entries", () => {
	assert.deepEqual(resolveWorktreeSetupIgnorePaths(undefined), [
		".venv",
		".pi",
		".pi-smart-router",
	]);
	assert.deepEqual(resolveWorktreeSetupIgnorePaths({ worktreeSetupIgnorePaths: ["custom-hook"] }), [
		".venv",
		".pi",
		".pi-smart-router",
		"custom-hook",
	]);
});

test("filterPorcelain drops porcelain entries under .pi/ and .pi-smart-router/ trees", () => {
	const porcelain = [
		"?? .pi/",
		"?? .pi-smart-router/",
		" M src/config/spine-config-load.mjs",
	].join("\n");
	const filtered = filterPorcelain(porcelain, [...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS]);
	assert.equal(filtered, " M src/config/spine-config-load.mjs");
});

test("filterPorcelain keeps pi runtime trees when task fileScope opts in", () => {
	const porcelain = ["?? .pi/", "?? .pi-smart-router/", " M src/app.mjs"].join("\n");
	const filtered = filterPorcelain(
		porcelain,
		[...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS],
		[".pi"],
	);
	assert.equal(filtered, ["?? .pi/", " M src/app.mjs"].join("\n"));
});

test("commitLaneWorktree skips untracked .pi/ and .pi-smart-router/ trees at lane commit", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-pi-ignore-");
	try {
		unignorePiRuntimeTrees(projectRoot);
		const batchId = "20260821T050300";
		const taskId = "SP-711";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-pi-ignore`);

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
		// Untracked pi session trees, as a pi worker leaves behind in a lane worktree.
		fs.mkdirSync(path.join(worktreePath, ".pi", "sessions"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, ".pi", "sessions", "main.jsonl"), "{}\n", "utf-8");
		fs.mkdirSync(path.join(worktreePath, ".pi-smart-router"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, ".pi-smart-router", "state.db"), "db\n", "utf-8");
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, true);
		assert.ok(result.skippedIgnorePaths?.some((p) => p.startsWith(".pi/")));
		assert.ok(result.skippedIgnorePaths?.some((p) => p.startsWith(".pi-smart-router/")));

		const committedFiles = execFileSync("git", ["show", "--name-only", "--pretty=format:", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		assert.equal(committedFiles.includes(".pi"), false);
		assert.equal(committedFiles.includes(".pi-smart-router"), false);
		assert.equal(committedFiles.includes("lane-change.txt"), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree treats only-pi-runtime dirty as clean without .DONE", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-pi-only-");
	try {
		unignorePiRuntimeTrees(projectRoot);
		const batchId = "20260821T050301";
		const taskId = "SP-711";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-pi-only`);

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
		fs.mkdirSync(path.join(worktreePath, ".pi"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, ".pi", "session.jsonl"), "{}\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, false);
		assert.ok(result.skippedIgnorePaths?.some((p) => p.startsWith(".pi")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
