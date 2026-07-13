import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	commitLaneWorktree,
	countCommitsAhead,
	filterPorcelain,
} from "../../src/batch/lane-commit.mjs";
import {
	DEFAULT_WORKTREE_SETUP_IGNORE_PATHS,
	resolveWorktreeSetupIgnorePaths,
} from "../../src/config/spine-config-load.mjs";
import { mergeLaneToOrch } from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("resolveWorktreeSetupIgnorePaths defaults to .venv when unset or empty", () => {
	assert.deepEqual(resolveWorktreeSetupIgnorePaths(undefined), [...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS]);
	assert.deepEqual(resolveWorktreeSetupIgnorePaths({}), [...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS]);
	assert.deepEqual(resolveWorktreeSetupIgnorePaths({ worktreeSetupIgnorePaths: [] }), [
		...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS,
	]);
	assert.deepEqual(resolveWorktreeSetupIgnorePaths({ worktreeSetupIgnorePaths: ["pi-spine"] }), [
		".venv",
		"pi-spine",
	]);
});

test("commitLaneWorktree commits dirty worktree when .DONE exists", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-");
	try {
		const batchId = "20260601T150000";
		const taskId = "TP-999";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

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
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

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

test("filterPorcelain drops lines matching ignore patterns by full path", () => {
	const porcelain = [" M pi-spine", " M src/app.mjs"].join("\n");
	const filtered = filterPorcelain(porcelain, ["pi-spine"]);
	assert.equal(filtered, " M src/app.mjs");
});

test("filterPorcelain drops lines matching ignore patterns by basename", () => {
	const porcelain = ["?? vendor/pi-spine"].join("\n");
	const filtered = filterPorcelain(porcelain, ["pi-spine"]);
	assert.equal(filtered, "");
});

test("filterPorcelain keeps rename targets when only source matches ignore", () => {
	const porcelain = "R  old.txt -> src/app.mjs";
	const filtered = filterPorcelain(porcelain, ["old.txt"]);
	assert.equal(filtered, porcelain);
});

test("filterPorcelain returns empty for empty input", () => {
	assert.equal(filterPorcelain("", ["pi-spine"]), "");
	assert.equal(filterPorcelain("   \n", ["pi-spine"]), "");
});

test("filterPorcelain keeps ignore paths listed in fileScope", () => {
	const porcelain = ["?? .venv", " M src/app.mjs"].join("\n");
	const filtered = filterPorcelain(porcelain, [".venv"], [".venv"]);
	assert.equal(filtered, porcelain);
});

test("commitLaneWorktree skips untracked .venv symlink and does not fail", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-venv-");
	try {
		const batchId = "20260601T150010";
		const taskId = "SP-640";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-venv`);

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
		const venvTarget = path.join(projectRoot, "fake-venv-target");
		fs.mkdirSync(venvTarget, { recursive: true });
		fs.symlinkSync(venvTarget, path.join(worktreePath, ".venv"));
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
			ignorePatterns: [".venv"],
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, true);
		assert.ok(result.skippedIgnorePaths?.includes(".venv"));

		const after = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.notEqual(before, after);

		const committedFiles = execFileSync("git", ["show", "--name-only", "--pretty=format:", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		assert.equal(committedFiles.includes(".venv"), false);
		assert.equal(committedFiles.includes("lane-change.txt"), true);
		assert.ok(fs.lstatSync(path.join(worktreePath, ".venv")).isSymbolicLink());
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree treats only-.venv dirty as clean without .DONE", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-venv-only-");
	try {
		const batchId = "20260601T150011";
		const taskId = "SP-640";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-venv-only`);

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
		const venvTarget = path.join(projectRoot, "fake-venv-target");
		fs.mkdirSync(venvTarget, { recursive: true });
		fs.symlinkSync(venvTarget, path.join(worktreePath, ".venv"));

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, false);
		assert.ok(result.skippedIgnorePaths?.includes(".venv"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch rejects empty merge when lane commits were required", async () => {
	const projectRoot = await initGitRepo("spine-empty-merge-");
	try {
		const batchId = "20260601T160000";
		const orchBranch = `orch/spine-${batchId}`;
		const taskBranch = `task/spine-lane-1-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", taskBranch, orchBranch], { cwd: projectRoot, stdio: "ignore" });

		assert.equal(countCommitsAhead(projectRoot, orchBranch, taskBranch), 0);

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: true,
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "EmptyMerge");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
