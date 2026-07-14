import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { commitLaneAndValidateWorktree } from "../../src/batch/engine-lanes/commit.mjs";
import {
	sanitizeGitignoredArtifactsBeforeLaneCommit,
} from "../../src/batch/lane-dirty-check.mjs";
import { commitLaneWorktree, gitPorcelain } from "../../src/batch/lane-commit.mjs";
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

function seedGraphifyOut(worktreePath) {
	const graphifyDir = path.join(worktreePath, "graphify-out", "cache", "ast", "v0.9.4");
	fs.mkdirSync(graphifyDir, { recursive: true });
	fs.writeFileSync(path.join(worktreePath, "graphify-out", ".graphify_labels.json"), "{}\n", "utf-8");
	fs.writeFileSync(path.join(worktreePath, "graphify-out", ".pending_changes"), "1\n", "utf-8");
	fs.writeFileSync(path.join(graphifyDir, "abc123.json"), "{}\n", "utf-8");
}

test("commitLaneWorktree re-cleans graphify-out regenerated after first sanitize", async () => {
	const projectRoot = await initGitRepo("spine-graphify-out-regen-race-");
	try {
		const batchId = "20260713T206001";
		const taskId = "SP-659";

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "graphify-out/\n", "utf-8");
		execCommit(projectRoot, "gitignore graphify-out");

		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-race`);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		execCommit(worktreePath, "commit .DONE");

		seedGraphifyOut(worktreePath);
		const { cleanedRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(worktreePath, {
			porcelain: gitPorcelain(worktreePath),
		});
		assert.deepEqual(cleanedRoots, ["graphify-out"]);
		assert.equal(fs.existsSync(path.join(worktreePath, "graphify-out")), false);

		// Simulate post-sanitize / post-commit hook regeneration (#206 race).
		seedGraphifyOut(worktreePath);
		assert.equal(fs.existsSync(path.join(worktreePath, "graphify-out", ".pending_changes")), true);

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
			projectRoot,
			ignorePatterns: [],
			fileScopePaths: [],
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, false);
		assert.equal(result.failureClass, undefined);
		assert.equal(fs.existsSync(path.join(worktreePath, "graphify-out", ".pending_changes")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneAndValidateWorktree survives post-commit graphify-out regenerate", async () => {
	const projectRoot = await initGitRepo("spine-graphify-out-postcommit-race-");
	try {
		const batchId = "20260713T206002";
		const taskId = "SP-659";

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "graphify-out/\n", "utf-8");
		execCommit(projectRoot, "gitignore graphify-out");

		const { worktreePath, taskBranch } = createLaneWorktree(projectRoot, batchId);
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-postcommit`);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		fs.writeFileSync(path.join(worktreePath, "lane-change.txt"), "work\n", "utf-8");

		// Worktrees use the main repo's common git dir for hooks.
		const commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		const absoluteCommon = path.isAbsolute(commonDir)
			? commonDir
			: path.resolve(worktreePath, commonDir);
		const commonHooks = path.join(absoluteCommon, "hooks");
		fs.mkdirSync(commonHooks, { recursive: true });
		const hookPath = path.join(commonHooks, "post-commit");
		const previousHook = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, "utf-8") : null;
		fs.writeFileSync(
			hookPath,
			`#!/bin/sh\nmkdir -p graphify-out/cache\necho regen > graphify-out/.pending_changes\necho '{}' > graphify-out/.graphify_labels.json\n`,
			{ mode: 0o755 },
		);

		try {
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
				laneCorrelationId: "corr-659",
				state,
				config: {},
			});

			assert.equal(result.ok, true);
			assert.equal(result.laneCommit.committed, true);
			assert.equal(fs.existsSync(path.join(worktreePath, "graphify-out", ".pending_changes")), false);
		} finally {
			if (previousHook === null) {
				fs.rmSync(hookPath, { force: true });
			} else {
				fs.writeFileSync(hookPath, previousHook, { mode: 0o755 });
			}
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
