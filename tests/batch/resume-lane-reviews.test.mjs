/**
 * SP-359 — resume path runs contract/final review before lane commit.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { taskAlreadyComplete } from "../../src/batch/resume-common.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("taskAlreadyComplete returns false for failed task with stale .DONE on disk", () => {
	const taskFolder = "/tmp/spine-task-folder";
	const events = [];
	const task = { taskId: "SP-358", status: "failed", doneFileFound: false };
	const originalExists = fs.existsSync;
	fs.existsSync = (p) => (p === path.join(taskFolder, ".DONE") ? true : originalExists(p));
	try {
		assert.equal(taskAlreadyComplete({ taskFolder, events, task }), false);
	} finally {
		fs.existsSync = originalExists;
	}
});

test("resumeBatch after failed retry runs contract verification before succeed", async () => {
	const projectRoot = await initGitRepo("spine-resume-contract-review-");
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const taskId = "SP-359";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-resume-contract-review`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`${minimalValidPromptMarkdown(taskId, {
				fileScope: "src/batch/resume-lane-reviews.mjs",
				mission: "Regression fixture for resume contract review.",
			})}

## Review Level: 2 (Plan + Code)

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/batch/resume-lane-reviews.mjs\` |
`,
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "fixture"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260629T231500";
		const orchBranch = `orch/spine-${batchId}`;
		const taskBranch = laneTaskBranch(batchId, 1);
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const taskFolderInWorktree = path.join(worktreePath, "spine-tasks", `${taskId}-resume-contract-review`);
		fs.mkdirSync(taskFolderInWorktree, { recursive: true });
		fs.copyFileSync(path.join(folder, "PROMPT.md"), path.join(taskFolderInWorktree, "PROMPT.md"));
		fs.writeFileSync(
			path.join(taskFolderInWorktree, ".DONE"),
			JSON.stringify({ taskId, completedAt: new Date().toISOString() }, null, 2),
			"utf-8",
		);
		const marker = path.join(worktreePath, "src/batch/resume-lane-reviews.mjs");
		fs.mkdirSync(path.dirname(marker), { recursive: true });
		fs.writeFileSync(marker, "// resume contract review fixture\n", "utf-8");
		execFileSync("git", ["add", "-A"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane work"], { cwd: worktreePath, stdio: "ignore" });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "failed",
					taskFolder: path.join("spine-tasks", `${taskId}-resume-contract-review`),
					startedAt: Date.now() - 60_000,
					endedAt: Date.now() - 30_000,
					doneFileFound: true,
					exitReason: "review_exhausted",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath,
					branch: taskBranch,
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "failed";
		state.failedTasks = 1;
		state.resilience = { retryCountByScope: { [taskId]: 1 } };
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, batchId);
		const types = events.map((event) => event.type);
		const reviewStarted = events.some((event) => event.type === "review.started");
		const contractVerified = events.some((event) => event.type === "contract.verified");
		const finalPass = events.some(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.payload?.reviewType === "final" &&
				event.payload?.verdict === "PASS",
		);
		assert.ok(reviewStarted, `expected review.started before commit, got: ${types.join(", ")}`);
		assert.ok(
			contractVerified || finalPass,
			`expected contract.verified or final PASS verdict, got: ${types.join(", ")}`,
		);
		const planStartedIdx = events.findIndex(
			(event) => event.type === "review.started" && event.payload?.reviewType === "plan",
		);
		const codeStartedIdx = events.findIndex(
			(event) => event.type === "review.started" && event.payload?.reviewType === "code",
		);
		assert.ok(
			planStartedIdx >= 0,
			`expected resume path to run engine plan review (SP-695), got: ${types.join(", ")}`,
		);
		assert.ok(
			codeStartedIdx >= 0 && planStartedIdx < codeStartedIdx,
			"resume path must run plan review before code review",
		);
		const planVerdict = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.payload?.reviewType === "plan" &&
				event.payload?.verdict === "APPROVE",
		);
		assert.ok(planVerdict, "expected plan APPROVE verdict recorded on resume path");
		const completedIdx = types.indexOf("task.completed");
		const reviewIdx = types.indexOf("review.started");
		assert.ok(reviewIdx >= 0 && reviewIdx < completedIdx, "review must precede task.completed");

		const loaded = loadSpineBatchState(projectRoot).raw;
		assert.equal(loaded.tasks[0].status, "succeeded");
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		await destroyGitRepo(projectRoot);
	}
});
