/**
 * SP-512 — doneInLane terminal reconcile (#170 / FR-STA-01).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { classifyTaskDoneSemantics } from "../../src/batch/diagnosis-task-done.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	detectBatchStateDrift,
	journalShowsDoneInLaneTerminalArtifacts,
	rebuildBatchStateFromJournal,
	reconcileBatchStateDrift,
} from "../../src/batch/journal-rebuild.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {{ batchId?: string, taskId?: string }} [options]
 */
function setupDoneInLaneDriftFixture(
	projectRoot,
	{ batchId = "20260705T210857", taskId = "SP-440" } = {},
) {
	const taskFolder = `spine-tasks/${taskId}-smoke`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	const laneTaskFolder = path.join(wt, taskFolder);
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = laneTaskBranch(batchId, 1);
	const hostTaskFolder = path.join(projectRoot, taskFolder);

	fs.mkdirSync(hostTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(hostTaskFolder, "PROMPT.md"), "# Task\n", "utf-8");

	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync(
		"git",
		["worktree", "add", "-b", taskBranch, wt, orchBranch],
		{ cwd: projectRoot, stdio: "ignore" },
	);
	fs.mkdirSync(laneTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(laneTaskFolder, "PROMPT.md"), "# Task\n", "utf-8");
	fs.writeFileSync(path.join(laneTaskFolder, ".DONE"), "Completed: 2026-07-05\n", "utf-8");
	execFileSync("git", ["add", `${taskFolder}/.DONE`, `${taskFolder}/PROMPT.md`], {
		cwd: wt,
		stdio: "ignore",
	});
	execFileSync("git", ["commit", "-m", "worker: add .DONE"], { cwd: wt, stdio: "ignore" });

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
				startedAt: Date.now() - 60_000,
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
	state.phase = "running";
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });
	appendJournalEvent(projectRoot, batchId, "lane.completed", { taskId, laneNumber: 1 });
	appendJournalEvent(projectRoot, batchId, "review.completed", {
		taskId,
		laneNumber: 1,
		reviewType: "code",
		verdict: "APPROVE",
	});
	appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
		taskId,
		verdict: "APPROVE",
	});

	return { batchId, taskId, state, taskFolder, wt, taskBranch };
}

/**
 * #190 negative — journal terminal artifacts without committed `.DONE`.
 *
 * @param {string} projectRoot
 * @param {{ batchId?: string, taskId?: string }} [options]
 */
function setupDoneInLaneTerminalWithoutDoneFixture(
	projectRoot,
	{ batchId = "20260709T211740", taskId = "SP-146" } = {},
) {
	const taskFolder = `spine-tasks/${taskId}-smoke`;
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	const laneTaskFolder = path.join(wt, taskFolder);
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = laneTaskBranch(batchId, 1);
	const hostTaskFolder = path.join(projectRoot, taskFolder);

	fs.mkdirSync(hostTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(hostTaskFolder, "PROMPT.md"), "# Task\n", "utf-8");
	fs.writeFileSync(path.join(hostTaskFolder, "STATUS.md"), "**Status:** complete\n", "utf-8");

	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	fs.mkdirSync(path.dirname(wt), { recursive: true });
	execFileSync(
		"git",
		["worktree", "add", "-b", taskBranch, wt, orchBranch],
		{ cwd: projectRoot, stdio: "ignore" },
	);
	fs.mkdirSync(laneTaskFolder, { recursive: true });
	fs.writeFileSync(path.join(laneTaskFolder, "PROMPT.md"), "# Task\n", "utf-8");
	fs.writeFileSync(path.join(laneTaskFolder, "STATUS.md"), "**Status:** complete\n", "utf-8");

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
				startedAt: Date.now() - 60_000,
				doneFileFound: false,
				classification: "terminal-success",
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
	state.phase = "running";
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });
	appendJournalEvent(projectRoot, batchId, "lane.completed", { taskId, laneNumber: 1 });
	appendJournalEvent(projectRoot, batchId, "contract.verified", {
		taskId,
		laneNumber: 1,
		ok: true,
	});

	return { batchId, taskId, state, taskFolder, wt, taskBranch };
}

test("journalShowsDoneInLaneTerminalArtifacts requires lane.completed and approved review", () => {
	const events = [
		{ type: "lane.completed", taskId: "SP-440" },
		{ type: "review.completed", taskId: "SP-440", payload: { verdict: "APPROVE" } },
	];
	assert.equal(journalShowsDoneInLaneTerminalArtifacts(events, "SP-440"), true);
	assert.equal(journalShowsDoneInLaneTerminalArtifacts(events, "SP-441"), false);
	assert.equal(
		journalShowsDoneInLaneTerminalArtifacts([{ type: "lane.completed", taskId: "SP-440" }], "SP-440"),
		false,
	);
});

test("reconcileBatchStateDrift promotes running cache when lane .DONE and review APPROVE", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-done-inlane-");
	try {
		const { batchId, taskId } = setupDoneInLaneDriftFixture(projectRoot);
		const loaded = loadSpineBatchState(projectRoot);
		const journalEvents = readJournalEvents(projectRoot, batchId);
		const classified = (loaded.raw?.tasks ?? []).map((task) =>
			classifyTaskDoneSemantics(task, {
				tasksRoot: path.join(projectRoot, "spine-tasks"),
				projectRoot,
				batchId,
				lanes: loaded.raw?.lanes ?? [],
			}),
		);
		const rebuilt = rebuildBatchStateFromJournal(loaded.raw, journalEvents);
		const drift = detectBatchStateDrift(loaded.raw, rebuilt, journalEvents, classified);
		assert.equal(drift.drifted, true);
		assert.equal(drift.entries[0]?.field, "doneInLane");

		const healed = reconcileBatchStateDrift({
			projectRoot,
			state: loaded.raw,
			classifiedTasks: classified,
			journalEvents,
			drift,
		});
		assert.equal(healed.reconciled, true);
		assert.deepEqual(healed.taskIds, [taskId]);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].status, "succeeded");
		assert.equal(saved?.tasks[0].doneFileFound, true);
		assert.equal(saved?.succeededTasks, 1);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === taskId));

		const driftAfter = detectBatchStateDrift(
			saved,
			rebuildBatchStateFromJournal(saved, events),
			events,
			classified.map((task) => ({ ...task, status: "succeeded", classification: "terminal-success" })),
		);
		assert.equal(driftAfter.drifted, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch auto-heals #170 drift scenario and clears state_drift diagnosis", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-batch-done-inlane-");
	try {
		const { taskId } = setupDoneInLaneDriftFixture(projectRoot);

		const before = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(before.diagnosis, "state_drift");
		assert.notEqual(before.suggestedCommand, `spine batch pause && spine batch retry ${taskId}`);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].status, "succeeded");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatchStateDrift is idempotent when called twice", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-done-inlane-idempotent-");
	try {
		const { batchId, taskId } = setupDoneInLaneDriftFixture(projectRoot);
		const loaded = loadSpineBatchState(projectRoot);
		let journalEvents = readJournalEvents(projectRoot, batchId);
		let classified = (loaded.raw?.tasks ?? []).map((task) =>
			classifyTaskDoneSemantics(task, {
				tasksRoot: path.join(projectRoot, "spine-tasks"),
				projectRoot,
				batchId,
				lanes: loaded.raw?.lanes ?? [],
			}),
		);
		let rebuilt = rebuildBatchStateFromJournal(loaded.raw, journalEvents);
		let drift = detectBatchStateDrift(loaded.raw, rebuilt, journalEvents, classified);

		const first = reconcileBatchStateDrift({
			projectRoot,
			state: loaded.raw,
			classifiedTasks: classified,
			journalEvents,
			drift,
		});
		assert.equal(first.reconciled, true);

		journalEvents = readJournalEvents(projectRoot, batchId);
		classified = (loaded.raw?.tasks ?? []).map((task) =>
			classifyTaskDoneSemantics(task, {
				tasksRoot: path.join(projectRoot, "spine-tasks"),
				projectRoot,
				batchId,
				lanes: loaded.raw?.lanes ?? [],
			}),
		);
		rebuilt = rebuildBatchStateFromJournal(loaded.raw, journalEvents);
		drift = detectBatchStateDrift(loaded.raw, rebuilt, journalEvents, classified);

		const second = reconcileBatchStateDrift({
			projectRoot,
			state: loaded.raw,
			classifiedTasks: classified,
			journalEvents,
			drift,
		});
		assert.equal(second.reconciled, false);
		assert.equal(loadSpineBatchState(projectRoot).raw?.tasks[0].status, "succeeded");
		assert.equal(
			readJournalEvents(projectRoot, batchId).filter(
				(event) => event.type === "task.completed" && event.taskId === taskId,
			).length,
			1,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatchStateDrift does not promote when journal terminal but .DONE missing (#190)", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-no-done-");
	try {
		const { batchId, taskId } = setupDoneInLaneTerminalWithoutDoneFixture(projectRoot);
		const loaded = loadSpineBatchState(projectRoot);
		const journalEvents = readJournalEvents(projectRoot, batchId);
		const classified = (loaded.raw?.tasks ?? []).map((task) =>
			classifyTaskDoneSemantics(task, {
				tasksRoot: path.join(projectRoot, "spine-tasks"),
				projectRoot,
				batchId,
				lanes: loaded.raw?.lanes ?? [],
			}),
		);
		assert.equal(journalShowsDoneInLaneTerminalArtifacts(journalEvents, taskId), true);
		assert.equal(classified[0]?.doneInLane, false);

		const rebuilt = rebuildBatchStateFromJournal(loaded.raw, journalEvents);
		const drift = detectBatchStateDrift(loaded.raw, rebuilt, journalEvents, classified);

		const healed = reconcileBatchStateDrift({
			projectRoot,
			state: loaded.raw,
			classifiedTasks: classified,
			journalEvents,
			drift,
		});
		assert.equal(healed.reconciled, false);
		assert.deepEqual(healed.taskIds, []);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].status, "running");
		assert.equal(saved?.tasks[0].doneFileFound, false);
		assert.equal(
			readJournalEvents(projectRoot, batchId).some(
				(event) => event.type === "task.completed" && event.taskId === taskId,
			),
			false,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
