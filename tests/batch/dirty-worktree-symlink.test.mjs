import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chmodSync, writeFileSync } from "node:fs";
import test from "node:test";
import { commitLaneAndValidateWorktree } from "../../src/batch/engine-lanes/commit.mjs";
import {
	filterSetupHookSymlinkDriftPorcelain,
	isSymlinkOnlyDriftPorcelain,
	isWorktreeDeletionPorcelainLine,
	parseLaneWorktreeIdentity,
	resolvePostLaneCommitPorcelain,
} from "../../src/batch/lane-dirty-check.mjs";
import { gitPorcelain } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const MINIMAL_CONFIG = {
	configVersion: 1,
	project: { name: "x", description: "" },
	paths: { tasksRoot: "spine-tasks" },
	baseBranch: "main",
	testing: { build: "", test: "", testWithCoverage: "" },
	agents: {
		worker: { model: "inherit", thinking: "high" },
		reviewer: { model: "inherit", thinking: "medium" },
		supervisor: { model: "inherit", thinking: "off" },
	},
	lanes: { maxParallel: 3, queueExcess: true, workerBackend: "subprocess" },
	gates: {
		requireBeforeIntegrate: true,
		collectBuildEvidence: true,
		collectTestEvidence: true,
	},
	referenceDocs: [],
	standards: [],
	neverLoad: [],
	worktreeSetupHook: "scripts/spine-worktree-setup.sh",
};

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function writeSpineConfig(projectRoot, config) {
	const spineDir = path.join(projectRoot, ".spine");
	fs.mkdirSync(spineDir, { recursive: true });
	fs.writeFileSync(
		path.join(spineDir, "spine-config.json"),
		`${JSON.stringify(config, null, 2)}\n`,
		"utf-8",
	);
}

function writeSetupHook(projectRoot) {
	const hookPath = path.join(projectRoot, "scripts", "spine-worktree-setup.sh");
	fs.mkdirSync(path.dirname(hookPath), { recursive: true });
	writeFileSync(
		hookPath,
		`#!/bin/sh
set -eu
mkdir -p .hook-target
mkdir -p assets
rm -f assets/bundled_skins
ln -s "$(pwd)/.hook-target" assets/bundled_skins
echo '{"ok":true}'
`,
		"utf-8",
	);
	chmodSync(hookPath, 0o755);
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

test("isWorktreeDeletionPorcelainLine matches unstaged deletions", () => {
	assert.equal(isWorktreeDeletionPorcelainLine(" D assets/bundled_skins"), true);
	assert.equal(isWorktreeDeletionPorcelainLine(" M src/app.mjs"), false);
});

test("isSymlinkOnlyDriftPorcelain is true only for deletion-only porcelain", () => {
	assert.equal(isSymlinkOnlyDriftPorcelain(" D assets/bundled_skins"), true);
	assert.equal(
		isSymlinkOnlyDriftPorcelain([" D assets/bundled_skins", " D assets/plugins/foo"].join("\n")),
		true,
	);
	assert.equal(
		isSymlinkOnlyDriftPorcelain([" D assets/bundled_skins", " M lane-change.txt"].join("\n")),
		false,
	);
});

test("filterSetupHookSymlinkDriftPorcelain clears deletion-only drift", () => {
	const porcelain = " D assets/bundled_skins";
	assert.equal(filterSetupHookSymlinkDriftPorcelain(porcelain), "");
	assert.equal(filterSetupHookSymlinkDriftPorcelain(" M lane-change.txt"), " M lane-change.txt");
});

test("parseLaneWorktreeIdentity extracts batch and lane from worktree path", () => {
	const identity = parseLaneWorktreeIdentity(
		"/repo/.worktrees/spine-20260702T150000/lane-1",
	);
	assert.deepEqual(identity, { batchId: "20260702T150000", laneNumber: 1 });
});

test("resolvePostLaneCommitPorcelain repairs hook symlink drift", async () => {
	const projectRoot = await initGitRepo("spine-symlink-resolve-");
	try {
		writeSetupHook(projectRoot);
		writeSpineConfig(projectRoot, MINIMAL_CONFIG);
		fs.writeFileSync(path.join(projectRoot, "lane-change.txt"), "work\n", "utf-8");
		execCommit(projectRoot, "baseline");

		const batchId = "20260702T151000";
		const { worktreePath } = createLaneWorktree(projectRoot, batchId);
		const hookPath = path.join(projectRoot, "scripts", "spine-worktree-setup.sh");
		execFileSync(hookPath, [], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["add", "assets/bundled_skins"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "track hook symlink"], { cwd: worktreePath, stdio: "ignore" });

		const symlinkPath = path.join(worktreePath, "assets", "bundled_skins");
		assert.ok(fs.lstatSync(symlinkPath).isSymbolicLink());
		fs.unlinkSync(symlinkPath);
		assert.match(gitPorcelain(worktreePath), /assets\/bundled_skins/);

		const resolved = resolvePostLaneCommitPorcelain(worktreePath, {
			projectRoot,
			fileScopePaths: ["lane-change.txt"],
			porcelain: gitPorcelain(worktreePath),
		});
		assert.equal(resolved, "");
		assert.equal(gitPorcelain(worktreePath), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneAndValidateWorktree succeeds when hook symlink drifts after PASS", async () => {
	const projectRoot = await initGitRepo("spine-symlink-commit-gate-");
	try {
		writeSetupHook(projectRoot);
		writeSpineConfig(projectRoot, MINIMAL_CONFIG);

		const batchId = "20260702T151001";
		const taskId = "SP-429";
		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);
		fs.mkdirSync(taskFolder, { recursive: true });
		const hookPath = path.join(projectRoot, "scripts", "spine-worktree-setup.sh");

		execFileSync(hookPath, [], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["add", "assets/bundled_skins"], { cwd: worktreePath, stdio: "ignore" });
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit task work");

		const symlinkPath = path.join(worktreePath, "assets", "bundled_skins");
		fs.unlinkSync(symlinkPath);
		assert.match(gitPorcelain(worktreePath), /assets\/bundled_skins/);

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
			config: MINIMAL_CONFIG,
		});

		assert.equal(result.ok, true);
		assert.equal(gitPorcelain(worktreePath), "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
