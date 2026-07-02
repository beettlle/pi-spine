/**
 * SP-433 — resume --force must not re-run contract/review for already-succeeded tasks (#88).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	taskTerminalSuccessInBatch,
} from "../../src/batch/resume-common.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_OK_A = "SP-433A";
const TASK_OK_B = "SP-433B";
const TASK_FAIL = "SP-433C";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: `src/batch/${taskId}.mjs`,
			mission: "SP-433 multi-lane resume skip fixture.",
		}),
		"utf-8",
	);
	return folder;
}

test("taskTerminalSuccessInBatch requires succeeded status and journal task.completed", () => {
	const taskFolder = "/tmp/spine-sp433-task";
	const events = [
		{ type: "task.completed", taskId: TASK_OK_A },
		{ type: "lane.committed", taskId: TASK_OK_A },
	];
	const task = { taskId: TASK_OK_A, status: "succeeded", doneFileFound: true };
	assert.equal(taskTerminalSuccessInBatch({ events, task, taskFolder }), true);

	const pendingTask = { taskId: TASK_FAIL, status: "pending", doneFileFound: false };
	assert.equal(taskTerminalSuccessInBatch({ events: [], task: pendingTask, taskFolder }), false);
});

test("resume --force after partial retry does not review.start succeeded task IDs", async () => {
	const projectRoot = await initGitRepo("spine-resume-skip-succeeded-");
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		for (const taskId of [TASK_OK_A, TASK_OK_B, TASK_FAIL]) {
			writeSmokeTask(projectRoot, taskId);
		}
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify(
				{
					version: 1,
					tasks: { [TASK_OK_A]: [], [TASK_OK_B]: [], [TASK_FAIL]: [] },
				},
				null,
				2,
			),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "SP-433 fixture"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260702T153101";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lanes = [1, 2, 3].map((laneNumber) =>
			provisionLaneWorktree({ projectRoot, batchId, laneNumber, orchBranch }),
		);

		const succeededTaskDefs = [
			{ taskId: TASK_OK_A, laneNumber: 1 },
			{ taskId: TASK_OK_B, laneNumber: 2 },
		];
		for (const { taskId, laneNumber } of succeededTaskDefs) {
			const wt = lanes[laneNumber - 1].worktreePath;
			const taskFolderRel = `spine-tasks/${taskId}-smoke`;
			const taskFolderInWorktree = path.join(wt, taskFolderRel);
			fs.mkdirSync(taskFolderInWorktree, { recursive: true });
			fs.copyFileSync(
				path.join(projectRoot, taskFolderRel, "PROMPT.md"),
				path.join(taskFolderInWorktree, "PROMPT.md"),
			);
			fs.writeFileSync(
				path.join(taskFolderInWorktree, ".DONE"),
				JSON.stringify({ taskId, completedAt: new Date().toISOString() }, null, 2),
				"utf-8",
			);
			const marker = path.join(wt, "src/batch", `${taskId}.mjs`);
			fs.mkdirSync(path.dirname(marker), { recursive: true });
			fs.writeFileSync(marker, `// ${taskId}\n`, "utf-8");
			execFileSync("git", ["add", "-A"], { cwd: wt, stdio: "ignore" });
			execFileSync("git", ["commit", "-m", `${taskId} lane work`], { cwd: wt, stdio: "ignore" });
		}

		const failWt = lanes[2].worktreePath;
		const failFolder = path.join(failWt, "spine-tasks", `${TASK_FAIL}-smoke`);
		fs.mkdirSync(failFolder, { recursive: true });
		fs.copyFileSync(
			path.join(projectRoot, "spine-tasks", `${TASK_FAIL}-smoke`, "PROMPT.md"),
			path.join(failFolder, "PROMPT.md"),
		);

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[TASK_OK_A, TASK_OK_B, TASK_FAIL]],
			tasks: [
				{
					taskId: TASK_OK_A,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: `spine-tasks/${TASK_OK_A}-smoke`,
					startedAt: Date.now() - 120_000,
					endedAt: Date.now() - 90_000,
					doneFileFound: true,
					exitReason: "done",
				},
				{
					taskId: TASK_OK_B,
					laneNumber: 2,
					status: "succeeded",
					taskFolder: `spine-tasks/${TASK_OK_B}-smoke`,
					startedAt: Date.now() - 120_000,
					endedAt: Date.now() - 90_000,
					doneFileFound: true,
					exitReason: "done",
				},
				{
					taskId: TASK_FAIL,
					laneNumber: 3,
					status: "pending",
					taskFolder: `spine-tasks/${TASK_FAIL}-smoke`,
					startedAt: null,
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: lanes.map((lane, index) => ({
				laneNumber: index + 1,
				laneId: `lane-${index + 1}`,
				worktreePath: lane.worktreePath,
				branch: laneTaskBranch(batchId, index + 1),
				taskIds: [[TASK_OK_A], [TASK_OK_B], [TASK_FAIL]][index],
				lastHeartbeatAt: null,
			})),
		});
		state.phase = "failed";
		state.failedTasks = 0;
		state.succeededTasks = 2;
		state.resilience = { retryCountByScope: { [TASK_FAIL]: 1 } };
		for (const segment of state.segments ?? []) {
			if (segment.taskId === TASK_FAIL) segment.status = "pending";
			else segment.status = "succeeded";
		}
		saveSpineBatchState(projectRoot, state);

		for (const { taskId, laneNumber } of succeededTaskDefs) {
			appendJournalEvent(projectRoot, batchId, "task.completed", {
				taskId,
				laneNumber,
				laneId: `lane-${laneNumber}`,
			});
			appendJournalEvent(projectRoot, batchId, "lane.committed", {
				taskId,
				laneNumber,
				commitSha: "abc123",
			});
		}
		appendJournalEvent(projectRoot, batchId, "task.retry_requested", {
			taskId: TASK_FAIL,
			previousClassification: "failed",
		});

		const eventsBefore = readJournalEvents(projectRoot, batchId);
		const reviewStartedBefore = eventsBefore.filter((event) => event.type === "review.started").length;

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, batchId);
		const resumedIdx = events.findIndex((event) => event.type === "batch.resumed");
		assert.ok(resumedIdx >= 0, "expected batch.resumed");

		const reviewAfterResume = events
			.slice(resumedIdx)
			.filter((event) => event.type === "review.started");
		const reviewForSucceeded = reviewAfterResume.filter((event) =>
			[TASK_OK_A, TASK_OK_B].includes(event.taskId),
		);
		assert.equal(
			reviewForSucceeded.length,
			0,
			`must not review.start succeeded IDs after force resume; got: ${reviewForSucceeded.map((e) => e.taskId).join(", ")}`,
		);

		assert.ok(
			events.some(
				(event) =>
					event.type === "task.started" &&
					event.taskId === TASK_FAIL &&
					events.indexOf(event) > resumedIdx,
			),
			"failed/retried task should still start after force resume",
		);

		const loaded = loadSpineBatchState(projectRoot).raw;
		assert.equal(loaded.tasks.find((task) => task.taskId === TASK_OK_A)?.status, "succeeded");
		assert.equal(loaded.tasks.find((task) => task.taskId === TASK_OK_B)?.status, "succeeded");
		assert.equal(loaded.tasks.find((task) => task.taskId === TASK_FAIL)?.status, "succeeded");

		assert.equal(reviewStartedBefore, 0, "fixture should not pre-seed review.started");
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		await destroyGitRepo(projectRoot);
	}
});
