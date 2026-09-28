import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { mergeLaneToOrch, mergeWaveLanesToOrch } from "../../src/batch/engine-lanes/merge.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * Real out-of-scope conflict (SP-798 / #304): both orch and the lane commit
 * different content for a path outside the lane File Scope. The old resolver
 * silently discarded the lane side via `git checkout --ours`; it must now fail
 * closed and tell the operator how to allow the discard.
 */
test("mergeLaneToOrch fails closed when both sides changed an out-of-scope path", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-out-of-scope-");
	try {
		const batchId = "20260614T003849";
		const orchBranch = `orch/spine-${batchId}`;
		const lane2Branch = `task/spine-lane-2-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 1;\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "export {};\n", "utf-8");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", lane2Branch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 2;\n", "utf-8");
		execCommit(projectRoot, "orch parallel.ts");

		execFileSync("git", ["checkout", lane2Branch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "import './parallel.ts';\nexport {};\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 99;\n", "utf-8");
		execCommit(projectRoot, "lane2 index.ts + out-of-scope parallel.ts");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: lane2Branch,
			batchId,
			laneFileScopePaths: ["index.ts"],
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeConflict");
		assert.match(
			merge.error,
			/Lane 2 \(task\/spine-lane-2-20260614T003849\) changed out-of-scope path parallel\.ts that also changed on orch\/spine-20260614T003849; add it to File Scope or lanes\.outOfScopeMergeAllowList/,
		);

		// The lane-committed out-of-scope change must survive on its branch — the
		// fail-closed return may not touch the orch tree either.
		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		const parallel = fs.readFileSync(path.join(projectRoot, "parallel.ts"), "utf-8");
		assert.match(parallel, /v = 2/);
		const laneParallel = execFileSync(
			"git",
			["show", `${lane2Branch}:parallel.ts`],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.match(laneParallel, /v = 99/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch does not auto-resolve in-scope lane conflicts", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-in-scope-conflict-");
	try {
		const batchId = "20260614T003850";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-2-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, "index.ts"), "orch\n", "utf-8");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "orch-v2\n", "utf-8");
		execCommit(projectRoot, "orch index");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "index.ts"), "lane-v1\n", "utf-8");
		execCommit(projectRoot, "lane index");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: ["index.ts"],
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeConflict");
		assert.match(merge.error, /index\.ts/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch returns discardedOutOfScope with the lane blob for allow-listed paths", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-allow-list-");
	try {
		const batchId = "20260927T101001";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-1-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "base\n", "utf-8");
		fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const v = 0;\n", "utf-8");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "orch\n", "utf-8");
		execCommit(projectRoot, "orch lock");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "lane-v99\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const v = 1;\n", "utf-8");
		execCommit(projectRoot, "lane lock + in-scope work");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: ["src/index.ts"],
		});

		assert.equal(merge.ok, true, merge.error);
		const expectedBlob = execFileSync(
			"git",
			["rev-parse", `${laneBranch}:package-lock.json`],
			{ cwd: projectRoot, encoding: "utf-8" },
		).trim();
		assert.deepEqual(merge.discardedOutOfScope, [
			{ path: "package-lock.json", laneBlob: expectedBlob },
		]);

		// The journaled blob must recover the discarded lane content byte for byte.
		const blobContent = execFileSync(
			"git",
			["cat-file", "-p", expectedBlob],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(blobContent, "lane-v99\n");

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		assert.equal(
			fs.readFileSync(path.join(projectRoot, "package-lock.json"), "utf-8"),
			"orch\n",
		);
		assert.match(
			fs.readFileSync(path.join(projectRoot, "src", "index.ts"), "utf-8"),
			/v = 1/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeWaveLanesToOrch journals batch.merge_out_of_scope_discarded for allow-listed paths", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-discard-journal-");
	try {
		const batchId = "20260927T101002";
		const taskId = "SP-799";
		const taskFolderRel = `spine-tasks/${taskId}-smoke`;
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = laneTaskBranch(batchId, 1);

		fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "base\n", "utf-8");
		fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const v = 0;\n", "utf-8");
		const taskFolder = path.join(projectRoot, taskFolderRel);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			minimalValidPromptMarkdown(taskId, {
				fileScope: "src/index.ts",
				mission: "SP-798 discard journal fixture.",
			}),
			"utf-8",
		);
		fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "done\n", "utf-8");
		execCommit(projectRoot, "base + task folder");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "orch\n", "utf-8");
		execCommit(projectRoot, "orch lock");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "package-lock.json"), "lane-v99\n", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const v = 1;\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), `${taskId} done\n`, "utf-8");
		execCommit(projectRoot, "lane lock + in-scope work + .DONE");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: path.join(projectRoot, taskFolderRel),
					startedAt: Date.now() - 60_000,
					endedAt: Date.now() - 30_000,
					doneFileFound: true,
					exitReason: "done",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1"),
					branch: laneBranch,
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});

		const merge = mergeWaveLanesToOrch({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			orchBranch,
			waveIndex: 0,
		});

		assert.equal(merge.ok, true, merge.error);
		const expectedBlob = execFileSync(
			"git",
			["rev-parse", `${laneBranch}:package-lock.json`],
			{ cwd: projectRoot, encoding: "utf-8" },
		).trim();

		const discardEvent = readJournalEvents(projectRoot, batchId).find(
			(event) => event.type === "batch.merge_out_of_scope_discarded",
		);
		assert.ok(discardEvent, "expected batch.merge_out_of_scope_discarded journal event");
		assert.equal(discardEvent.payload.laneNumber, 1);
		assert.equal(discardEvent.payload.taskBranch, laneBranch);
		assert.deepEqual(discardEvent.payload.paths, ["package-lock.json"]);
		assert.deepEqual(discardEvent.payload.laneBlobs, [expectedBlob]);

		const blobContent = execFileSync(
			"git",
			["cat-file", "-p", expectedBlob],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(blobContent, "lane-v99\n");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch classifies untracked-overwrite merge failures as MergeFailed", async () => {
	const projectRoot = await initGitRepo("spine-lane-merge-untracked-overwrite-");
	try {
		const batchId = "20260927T101003";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-1-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, "index.ts"), "export {};\n", "utf-8");
		execCommit(projectRoot, "base");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "untracked-file.txt"), "lane\n", "utf-8");
		execCommit(projectRoot, "lane adds untracked-file.txt");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "untracked-file.txt"), "local\n", "utf-8");

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: ["index.ts"],
		});

		assert.equal(merge.ok, false);
		assert.equal(merge.failureClass, "MergeFailed");
		assert.match(merge.error, /untracked working tree file/i);
		assert.match(merge.error, /untracked-file\.txt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * Resume parity (SP-798 / #304): the single-lane resume merge must pass the
 * task File Scope like the normal wave path. The fail-closed out-of-scope
 * message is only reachable with a non-empty File Scope, so matching it proves
 * parity — without it resume merges fall back to the generic conflict error.
 */
test("resumeBatch merges with the lane File Scope and fails closed on out-of-scope conflicts", async () => {
	const projectRoot = await initGitRepo("spine-resume-file-scope-parity-");
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const batchId = "20260927T101004";
		const taskId = "SP-798";
		const taskFolderRel = `spine-tasks/${taskId}-smoke`;
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = laneTaskBranch(batchId, 1);

		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 1;\n", "utf-8");
		fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const v = 0;\n", "utf-8");
		const taskFolder = path.join(projectRoot, taskFolderRel);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			minimalValidPromptMarkdown(taskId, {
				fileScope: "src/index.ts",
				mission: "SP-798 resume File Scope parity fixture.",
			}),
			"utf-8",
		);
		fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "done\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), `${taskId} done\n`, "utf-8");
		execCommit(projectRoot, "base + task folder");

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		// Provision the lane worktree from the orch tip BEFORE orch advances, so the
		// later parallel.ts edits on both sides produce a real two-sided conflict.
		const lane = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const wt = lane.worktreePath;

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "parallel.ts"), "export const v = 2;\n", "utf-8");
		execCommit(projectRoot, "orch parallel.ts");
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		fs.writeFileSync(path.join(wt, "parallel.ts"), "export const v = 99;\n", "utf-8");
		execCommit(wt, "lane out-of-scope parallel.ts");

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: taskFolderRel,
					startedAt: Date.now() - 120_000,
					endedAt: Date.now() - 90_000,
					doneFileFound: true,
					exitReason: "done",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: wt,
					branch: laneBranch,
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "failed";
		state.failedTasks = 0;
		state.succeededTasks = 1;
		for (const segment of state.segments ?? []) {
			segment.status = "succeeded";
		}
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
		});

		const result = await resumeBatch({ projectRoot, force: true });

		assert.equal(result.ok, false);
		assert.equal(result.error, "merge_failed");
		assert.match(result.output, /changed out-of-scope path parallel\.ts/);
		assert.match(result.output, /lanes\.outOfScopeMergeAllowList/);
		assert.doesNotMatch(result.output, /automatic resolution supports/);
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		await destroyGitRepo(projectRoot);
	}
});
