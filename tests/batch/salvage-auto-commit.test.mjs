import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import {
	attemptScopedSalvageCommit,
	hasWorktreeIndexConflicts,
	recordTaskFailureSalvage,
	resolveSalvageCommitRefusal,
	resolveSalvageConfig,
} from "../../src/batch/salvage.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {string} message
 */
function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} fileScopePath
 */
function writeSmokeTask(projectRoot, taskId, fileScopePath) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: fileScopePath,
			mission: "Salvage auto-commit smoke.",
		}),
		"utf-8",
	);
}

test("resolveSalvageConfig defaults autoCommitOnStall to false", () => {
	assert.equal(resolveSalvageConfig({}).autoCommitOnStall, false);
	assert.equal(resolveSalvageConfig({ lanes: {} }).autoCommitOnStall, false);
	assert.equal(resolveSalvageConfig({ lanes: { autoCommitOnStall: true } }).autoCommitOnStall, true);
});

test("validateSpineConfig rejects non-boolean autoCommitOnStall", () => {
	const base = JSON.parse(
		fs.readFileSync(
			path.join(import.meta.dirname, "../../templates/spine-config.json"),
			"utf-8",
		),
	);
	assert.equal(validateSpineConfig(base), null);
	assert.equal(
		validateSpineConfig({ ...base, lanes: { ...base.lanes, autoCommitOnStall: "yes" } })?.code,
		"CONFIG_LANES_INVALID",
	);
});

test("recordTaskFailureSalvage with autoCommitOnStall commits scoped paths on lane branch", async () => {
	const projectRoot = await initGitRepo("salvage-autocommit-");
	const batchId = "testbatch002";
	const taskId = "TP-910";
	const fileScope = "src/salvage-wip.txt";
	const outOfScope = "other-out.txt";
	writeSmokeTask(projectRoot, taskId, fileScope);
	fs.mkdirSync(path.dirname(path.join(projectRoot, fileScope)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, fileScope), "base\n", "utf-8");
	execCommit(projectRoot, "task");

	const taskBranch = `task/spine-lane-1-${batchId}`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync("git", ["worktree", "add", "-B", taskBranch, wt, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.writeFileSync(path.join(wt, fileScope), "uncommitted\n", "utf-8");
	fs.writeFileSync(path.join(wt, outOfScope), "stay dirty\n", "utf-8");

	const taskFolder = path.join(wt, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(taskFolder, { recursive: true });

	const headBefore = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();

	const salvageFields = recordTaskFailureSalvage({
		projectRoot,
		batchId,
		laneNumber: 1,
		laneId: "lane-1",
		taskId,
		correlationId: "corr-ac",
		worktreePath: wt,
		fileScopePaths: [fileScope],
		taskFolder,
		workerResult: { doneFound: false, classification: "stall_timeout" },
		config: { lanes: { autoCommitOnStall: true } },
		batchPhase: "running",
		taskBranch,
	});

	assert.equal(salvageFields.salvageCommitted, true);
	assert.ok(salvageFields.salvageCommitSha);

	const headAfter = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();
	assert.notEqual(headBefore, headAfter);

	const log = execFileSync("git", ["log", "-1", "--format=%s"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();
	assert.match(log, /^wip\(TP-910\): stall salvage /);

	const show = execFileSync("git", ["show", "--name-only", "--format=", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	});
	assert.ok(show.includes(fileScope));
	assert.ok(!show.includes(outOfScope));

	const events = readJournalEvents(projectRoot, batchId);
	const commitEvent = events.find((e) => e.type === "lane.salvage_commit");
	assert.ok(commitEvent);
	assert.equal(commitEvent.payload.committed, true);
	assert.equal(commitEvent.payload.refused, false);

	await destroyGitRepo(projectRoot);
});

test("recordTaskFailureSalvage without autoCommitOnStall does not commit", async () => {
	const projectRoot = await initGitRepo("salvage-nocommit-");
	const batchId = "testbatch003";
	const taskId = "TP-911";
	const fileScope = "src/no-wip.txt";
	writeSmokeTask(projectRoot, taskId, fileScope);
	fs.mkdirSync(path.dirname(path.join(projectRoot, fileScope)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, fileScope), "base\n", "utf-8");
	execCommit(projectRoot, "task");

	const taskBranch = `task/spine-lane-1-${batchId}`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	execFileSync("git", ["worktree", "add", "-B", taskBranch, wt, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.writeFileSync(path.join(wt, fileScope), "dirty\n", "utf-8");
	const taskFolder = path.join(wt, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(taskFolder, { recursive: true });

	const headBefore = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();

	recordTaskFailureSalvage({
		projectRoot,
		batchId,
		laneNumber: 1,
		laneId: "lane-1",
		taskId,
		correlationId: "corr-nc",
		worktreePath: wt,
		fileScopePaths: [fileScope],
		taskFolder,
		workerResult: { doneFound: false, classification: "stall_timeout" },
		config: { lanes: { autoCommitOnStall: false } },
		batchPhase: "running",
		taskBranch,
	});

	const headAfter = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();
	assert.equal(headBefore, headAfter);

	const events = readJournalEvents(projectRoot, batchId);
	assert.equal(events.some((e) => e.type === "lane.salvage_commit"), false);

	await destroyGitRepo(projectRoot);
});

test("salvage commit refuses merge_in_progress and index_conflicts", async () => {
	const projectRoot = await initGitRepo("salvage-refuse-");
	const batchId = "testbatch004";
	const taskId = "TP-912";
	const fileScope = "src/refuse.txt";
	const taskBranch = `task/spine-lane-1-${batchId}`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	execFileSync("git", ["worktree", "add", "-B", taskBranch, wt, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.mkdirSync(path.dirname(path.join(wt, fileScope)), { recursive: true });
	fs.writeFileSync(path.join(wt, fileScope), "dirty\n", "utf-8");

	const mergeRefusal = resolveSalvageCommitRefusal({ batchPhase: "merging", worktreePath: wt });
	assert.equal(mergeRefusal.refused, true);
	assert.equal(mergeRefusal.reason, "merge_in_progress");

	const mergeAttempt = attemptScopedSalvageCommit({
		worktreePath: wt,
		taskBranch,
		taskId,
		dirtyPaths: [fileScope],
		batchPhase: "merging",
	});
	assert.equal(mergeAttempt.committed, false);
	assert.equal(mergeAttempt.reason, "merge_in_progress");

	execFileSync("git", ["checkout", taskBranch], { cwd: wt, stdio: "ignore" });
	const conflictRel = "conflict.txt";
	const conflictFile = path.join(wt, conflictRel);
	fs.writeFileSync(conflictFile, "base\n", "utf-8");
	execFileSync("git", ["add", conflictRel], { cwd: wt, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "track conflict file"], { cwd: wt, stdio: "ignore" });
	const shaOurs = execFileSync("git", ["hash-object", "-w", "--stdin"], {
		cwd: wt,
		input: "ours\n",
		encoding: "utf-8",
	}).trim();
	const shaTheirs = execFileSync("git", ["hash-object", "-w", "--stdin"], {
		cwd: wt,
		input: "theirs\n",
		encoding: "utf-8",
	}).trim();
	const indexInfo = `160000 ${shaOurs} 2\t${conflictRel}\n160000 ${shaTheirs} 3\t${conflictRel}\n`;
	execFileSync("git", ["update-index", "--index-info"], {
		cwd: wt,
		input: indexInfo,
		encoding: "utf-8",
	});
	assert.equal(hasWorktreeIndexConflicts(wt), true);

	const conflictAttempt = attemptScopedSalvageCommit({
		worktreePath: wt,
		taskBranch,
		taskId,
		dirtyPaths: [fileScope],
		batchPhase: "running",
	});
	assert.equal(conflictAttempt.committed, false);
	assert.equal(conflictAttempt.reason, "index_conflicts");

	await destroyGitRepo(projectRoot);
});

test("salvage commit refuses pre-commit hook failure", async () => {
	const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "salvage-hook-"));
	const fileScope = "src/hook.txt";
	const taskBranch = "task/spine-lane-1-hook";
	const taskId = "TP-913";

	fs.mkdirSync(path.join(worktree, path.dirname(fileScope)), { recursive: true });
	execFileSync("git", ["init"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "t@e.com"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "T"], { cwd: worktree, stdio: "ignore" });
	fs.writeFileSync(path.join(worktree, fileScope), "base\n", "utf-8");
	execFileSync("git", ["add", "-A"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: worktree, stdio: "ignore" });
	execFileSync("git", ["checkout", "-b", taskBranch], { cwd: worktree, stdio: "ignore" });
	fs.mkdirSync(path.join(worktree, ".git", "hooks"), { recursive: true });
	fs.writeFileSync(
		path.join(worktree, ".git", "hooks", "pre-commit"),
		"#!/bin/sh\nexit 1\n",
		"utf-8",
	);
	fs.chmodSync(path.join(worktree, ".git", "hooks", "pre-commit"), 0o755);
	fs.writeFileSync(path.join(worktree, fileScope), "dirty\n", "utf-8");

	const result = attemptScopedSalvageCommit({
		worktreePath: worktree,
		taskBranch,
		taskId,
		dirtyPaths: [fileScope],
		batchPhase: "running",
	});
	assert.equal(result.committed, false);
	assert.equal(result.reason, "hook_or_commit_failed");

	fs.rmSync(worktree, { recursive: true, force: true });
});

test("atomic retry retains salvage WIP commit on lane branch", async () => {
	const projectRoot = await initGitRepo("salvage-retry-");
	const batchId = "testbatch005";
	const taskId = "TP-914";
	const fileScope = "src/retry-keep.txt";
	writeSmokeTask(projectRoot, taskId, fileScope);
	fs.mkdirSync(path.dirname(path.join(projectRoot, fileScope)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, fileScope), "base\n", "utf-8");
	execCommit(projectRoot, "task");

	const taskBranch = `task/spine-lane-1-${batchId}`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	execFileSync("git", ["worktree", "add", "-B", taskBranch, wt, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.writeFileSync(path.join(wt, fileScope), "wip\n", "utf-8");
	const taskFolder = path.join(wt, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(taskFolder, { recursive: true });

	recordTaskFailureSalvage({
		projectRoot,
		batchId,
		laneNumber: 1,
		laneId: "lane-1",
		taskId,
		correlationId: "corr-r",
		worktreePath: wt,
		fileScopePaths: [fileScope],
		taskFolder,
		workerResult: { doneFound: false, classification: "stall_timeout" },
		config: { lanes: { autoCommitOnStall: true } },
		batchPhase: "failed",
		taskBranch,
	});
	const salvageSha = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: `spine-tasks/${taskId}-smoke`,
				startedAt: Date.now() - 1000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "stall_timeout",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "failed";
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);

	const retry = retryTask({ projectRoot, taskId });
	assert.equal(retry.ok, true);

	const headAfterRetry = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: wt,
		encoding: "utf-8",
	}).trim();
	assert.equal(headAfterRetry, salvageSha);

	await destroyGitRepo(projectRoot);
});
