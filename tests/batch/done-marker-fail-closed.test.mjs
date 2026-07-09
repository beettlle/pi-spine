/**
 * SP-569 — fail-closed done-marker enforcement (#190).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { reconcilePausedResumeDoneInLane } from "../../src/batch/attached-runner.mjs";
import { mergeLaneToOrch } from "../../src/batch/engine-lanes/merge.mjs";
import {
	laneDoneMarkerCommittedOnBranch,
	laneDoneMarkerReadyForPromote,
} from "../../src/batch/journal-rebuild.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("laneDoneMarkerCommittedOnBranch requires committed .DONE on task branch", async () => {
	const projectRoot = await initGitRepo("spine-done-marker-committed-");
	try {
		const batchId = "20260709T211740";
		const taskId = "SP-146";
		const taskFolder = `spine-tasks/${taskId}-smoke`;
		const taskBranch = laneTaskBranch(batchId, 1);
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		const orchBranch = `orch/spine-${batchId}`;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, wt, orchBranch], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const laneTaskFolder = path.join(wt, taskFolder);
		fs.mkdirSync(laneTaskFolder, { recursive: true });
		fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "done\n", "utf-8");

		assert.equal(laneDoneMarkerCommittedOnBranch(projectRoot, taskBranch, taskFolder), false);

		execFileSync("git", ["add", `${taskFolder}/.DONE`], { cwd: wt, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "worker: .DONE"], { cwd: wt, stdio: "ignore" });

		assert.equal(laneDoneMarkerCommittedOnBranch(projectRoot, taskBranch, taskFolder), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("laneDoneMarkerReadyForPromote rejects filesystem-only .DONE", async () => {
	const projectRoot = await initGitRepo("spine-done-marker-ready-");
	try {
		const batchId = "20260709T211740";
		const taskId = "SP-146";
		const taskFolder = `spine-tasks/${taskId}-smoke`;
		const taskBranch = laneTaskBranch(batchId, 1);
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		const orchBranch = `orch/spine-${batchId}`;

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, wt, orchBranch], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const laneTaskFolder = path.join(wt, taskFolder);
		fs.mkdirSync(laneTaskFolder, { recursive: true });
		fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "done\n", "utf-8");

		const task = {
			taskId,
			laneNumber: 1,
			status: "running",
			taskFolder,
		};
		const lanes = [{ laneNumber: 1, worktreePath: wt, branch: taskBranch }];
		const classified = { doneInLane: true, classification: "terminal-success", status: "running" };

		assert.equal(
			laneDoneMarkerReadyForPromote({ projectRoot, batchId, task, lanes, classified }),
			false,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcilePausedResumeDoneInLane does not promote without committed .DONE", async () => {
	const projectRoot = await initGitRepo("spine-attached-no-done-");
	try {
		const batchId = "20260706T052912";
		const taskId = "SP-513";
		const taskFolder = `spine-tasks/${taskId}-smoke`;
		const taskBranch = laneTaskBranch(batchId, 1);
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		const orchBranch = `orch/spine-${batchId}`;

		fs.mkdirSync(path.join(projectRoot, "spine-tasks"), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ tasksRoot: "spine-tasks" }),
			"utf-8",
		);

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, wt, orchBranch], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const laneTaskFolder = path.join(wt, taskFolder);
		fs.mkdirSync(laneTaskFolder, { recursive: true });
		fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "done\n", "utf-8");

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "running",
					taskFolder,
					doneFileFound: false,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: wt,
					branch: taskBranch,
					taskIds: [taskId],
				},
			],
		});
		updateSegmentForTask(state, taskId, "running");
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "batch.resumed", {
			fromPhase: "paused",
			toPhase: "running",
			resumeForced: true,
		});
		appendJournalEvent(projectRoot, batchId, "contract.verified", {
			taskId,
			laneNumber: 1,
			ok: true,
		});

		const result = reconcilePausedResumeDoneInLane({ projectRoot, state, batchId });
		assert.equal(result.reconciled, false);
		assert.equal(state.tasks[0].status, "running");
		assert.equal(state.tasks[0].doneFileFound, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch fails when lane branch lacks committed .DONE", async () => {
	const projectRoot = await initGitRepo("spine-merge-no-done-");
	try {
		const batchId = "20260709T211740";
		const taskId = "SP-146";
		const taskFolder = `spine-tasks/${taskId}-smoke`;
		const orchBranch = `orch/spine-${batchId}`;
		const taskBranch = laneTaskBranch(batchId, 1);
		const wt = laneWorktreePath(projectRoot, batchId, 1);

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, wt, orchBranch], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const laneTaskFolder = path.join(wt, taskFolder);
		fs.mkdirSync(laneTaskFolder, { recursive: true });
		fs.writeFileSync(path.join(wt, "src-change.txt"), "work\n", "utf-8");
		execFileSync("git", ["add", "src-change.txt"], { cwd: wt, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane work without .DONE"], { cwd: wt, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch,
			batchId,
			laneTaskFolders: [taskFolder],
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "DoneMarkerMissing");
		assert.match(merge.error, /\.DONE/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
