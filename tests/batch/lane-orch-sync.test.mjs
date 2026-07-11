import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	collectSharedScopeSatisfiedDeps,
	ensureLaneSyncedForSharedScopeDeps,
} from "../../src/batch/engine-lanes.mjs";
import {
	provisionLaneWorktree,
	syncLaneWorktreeFromOrch,
} from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function git(cwd, args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string[]} fileScope
 */
function writeTaskPacket(projectRoot, taskId, fileScope) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-fixture`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, { fileScope: fileScope.join("\n- ") }),
		"utf-8",
	);
	return folder;
}

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} tasks
 */
function writeDependenciesJson(projectRoot, tasks) {
	fs.mkdirSync(path.join(projectRoot, "spine-tasks"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

test("syncLaneWorktreeFromOrch makes orch tip an ancestor of lane HEAD", async () => {
	const projectRoot = await initGitRepo("spine-lane-orch-sync-");
	try {
		const batchId = "20260710T191001";
		const orchBranch = `orch/spine-${batchId}`;
		git(projectRoot, ["branch", orchBranch, "main"]);

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 2,
			orchBranch,
		});

		const sharedPath = "src/batch/contract-verify.mjs";
		fs.mkdirSync(path.join(projectRoot, "src/batch"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, sharedPath), "export const phase = 'dep-a';\n", "utf-8");
		git(projectRoot, ["add", sharedPath]);
		git(projectRoot, ["commit", "-m", "dep A lands on orch"]);
		git(projectRoot, ["branch", "-f", orchBranch, "HEAD"]);
		const orchTip = git(projectRoot, ["rev-parse", orchBranch]);

		// merge-base --is-ancestor exits non-zero when orch tip is not yet on the lane
		assert.throws(() => git(worktreePath, ["merge-base", "--is-ancestor", orchTip, "HEAD"]));

		const result = syncLaneWorktreeFromOrch({
			worktreePath,
			orchBranch,
			projectRoot,
		});
		assert.equal(result.ok, true);
		assert.equal(result.skipped, false);

		assert.doesNotThrow(() =>
			git(worktreePath, ["merge-base", "--is-ancestor", orchTip, "HEAD"]),
		);
		assert.equal(
			fs.readFileSync(path.join(worktreePath, sharedPath), "utf-8"),
			"export const phase = 'dep-a';\n",
		);

		const second = syncLaneWorktreeFromOrch({
			worktreePath,
			orchBranch,
			projectRoot,
		});
		assert.equal(second.ok, true);
		assert.equal(second.skipped, true);
		assert.equal(second.reason, "already_contains_orch");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("ensureLaneSyncedForSharedScopeDeps syncs when succeeded dep shares File Scope", async () => {
	const projectRoot = await initGitRepo("spine-lane-orch-shared-");
	try {
		const batchId = "20260710T191002";
		const orchBranch = `orch/spine-${batchId}`;
		git(projectRoot, ["branch", orchBranch, "main"]);

		const sharedPath = "src/batch/contract-verify.mjs";
		const depFolder = writeTaskPacket(projectRoot, "SP-585", [sharedPath]);
		writeTaskPacket(projectRoot, "SP-603", [sharedPath]);
		writeDependenciesJson(projectRoot, {
			"SP-585": [],
			"SP-603": ["SP-585"],
		});
		git(projectRoot, ["add", "spine-tasks"]);
		git(projectRoot, ["commit", "-m", "task packets"]);
		git(projectRoot, ["branch", "-f", orchBranch, "HEAD"]);

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		fs.mkdirSync(path.join(projectRoot, "src/batch"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, sharedPath), "export const phase = 'after-585';\n", "utf-8");
		git(projectRoot, ["add", sharedPath]);
		git(projectRoot, ["commit", "-m", "SP-585 lands on orch"]);
		git(projectRoot, ["branch", "-f", orchBranch, "HEAD"]);
		const orchTip = git(projectRoot, ["rev-parse", orchBranch]);

		const state = {
			orchBranch,
			tasks: [
				{
					taskId: "SP-585",
					status: "succeeded",
					taskFolder: depFolder,
				},
				{
					taskId: "SP-603",
					status: "pending",
					taskFolder: path.join(projectRoot, "spine-tasks", "SP-603-fixture"),
				},
			],
		};

		const shared = collectSharedScopeSatisfiedDeps({
			projectRoot,
			state,
			taskId: "SP-603",
			fileScopePaths: [sharedPath],
		});
		assert.deepEqual(shared, [{ depId: "SP-585", overlap: [sharedPath] }]);

		assert.throws(() => git(worktreePath, ["merge-base", "--is-ancestor", orchTip, "HEAD"]));

		const result = ensureLaneSyncedForSharedScopeDeps({
			projectRoot,
			state,
			taskId: "SP-603",
			fileScopePaths: [sharedPath],
			worktreePath,
		});
		assert.equal(result.ok, true);
		assert.equal(result.synced, true);
		assert.doesNotThrow(() =>
			git(worktreePath, ["merge-base", "--is-ancestor", orchTip, "HEAD"]),
		);
		assert.equal(
			fs.readFileSync(path.join(worktreePath, sharedPath), "utf-8"),
			"export const phase = 'after-585';\n",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("syncLaneWorktreeFromOrch fails loud when lane worktree is dirty", async () => {
	const projectRoot = await initGitRepo("spine-lane-orch-dirty-");
	try {
		const batchId = "20260710T191003";
		const orchBranch = `orch/spine-${batchId}`;
		git(projectRoot, ["branch", orchBranch, "main"]);

		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		fs.writeFileSync(path.join(projectRoot, "orch-only.txt"), "on orch\n", "utf-8");
		git(projectRoot, ["add", "orch-only.txt"]);
		git(projectRoot, ["commit", "-m", "advance orch"]);
		git(projectRoot, ["branch", "-f", orchBranch, "HEAD"]);

		fs.writeFileSync(path.join(worktreePath, "dirty.txt"), "uncommitted\n", "utf-8");

		assert.throws(
			() =>
				syncLaneWorktreeFromOrch({
					worktreePath,
					orchBranch,
					projectRoot,
				}),
			/worktree is dirty/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
