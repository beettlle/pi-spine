/**
 * Batch pause and resume for single-lane batches (TP-015, PRD §18.2).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { commitLaneWorktree } from "./lane-commit.mjs";
import { mergeLaneToOrch } from "./engine.mjs";
import {
	countPendingSegments,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
	validateBatchState,
} from "./state.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";
import { detectSegmentDrift } from "./retry.mjs";
import { runWorker } from "./worker-host.mjs";

/**
 * @param {object} state
 * @param {string} fromPhase
 * @param {string} toPhase
 */
function recordPhaseTransition(projectRoot, batchId, fromPhase, toPhase, extra = {}) {
	if (fromPhase === toPhase) return;
	if (toPhase === "paused") {
		appendJournalEvent(projectRoot, batchId, "batch.paused", { fromPhase, toPhase, ...extra });
	}
	if (
		toPhase === "running" &&
		(fromPhase === "paused" || (fromPhase === "failed" && extra.resumeForced))
	) {
		appendJournalEvent(projectRoot, batchId, "batch.resumed", { fromPhase, toPhase, ...extra });
	}
}

/**
 * @param {string} projectRoot
 */
export function pauseBatch({ projectRoot }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	if (phase !== "running" && phase !== "planning") {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_pause",
			output: `Cannot pause batch in phase ${phase}. Only running or planning batches can be paused.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	const fromPhase = phase;
	state.phase = "paused";
	saveSpineBatchState(projectRoot, state);
	recordPhaseTransition(projectRoot, state.batchId, fromPhase, "paused");

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		phase: "paused",
		output: `Batch ${state.batchId} paused. No new tasks will be scheduled.\n  → spine batch resume\n`,
	};
}

/**
 * @param {object[]} events
 * @param {string} taskId
 */
function journalHasTaskCompleted(events, taskId) {
	return events.some((event) => event.type === "task.completed" && event.taskId === taskId);
}

/**
 * @param {object} params
 */
function taskAlreadyComplete({ taskFolder, events, task }) {
	const doneOnDisk = fs.existsSync(path.join(taskFolder, ".DONE"));
	return (
		doneOnDisk ||
		task.doneFileFound ||
		task.status === "succeeded" ||
		journalHasTaskCompleted(events, task.taskId)
	);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 */
export async function resumeBatch({ projectRoot, force = false }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	const resumable = phase === "paused" || (phase === "failed" && force);
	if (!resumable) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_resume",
			output:
				phase === "failed" && !force
					? `Batch ${state.batchId} failed. Use spine batch resume --force to continue.\n`
					: `Cannot resume batch in phase ${phase}.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	const validation = validateBatchState(state);
	if (!validation.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: "invalid_batch_state",
			output: `Batch state validation failed:\n  ${validation.errors.join("\n  ")}\n`,
			batchId: state.batchId,
		};
	}

	if (detectSegmentDrift(state) && !(phase === "failed" && force)) {
		const driftTask = state.tasks.find(
			(task) =>
				task?.status === "pending" &&
				state.segments?.some(
					(segment) =>
						segment?.taskId === task.taskId &&
						(segment.status === "failed" || segment.status === "succeeded"),
				),
		);
		const driftTaskId = driftTask?.taskId ?? state.tasks[0]?.taskId ?? "unknown";
		return {
			ok: false,
			exitCode: 1,
			error: "RetrySegmentDrift",
			failureClass: "RetrySegmentDrift",
			output: `Segment drift: task ${driftTaskId} is pending but segments are terminal.\n  → spine batch retry ${driftTaskId}\n  → spine batch resume --force\n`,
			batchId: state.batchId,
			taskId: driftTaskId,
		};
	}

	if (state.tasks.length !== 1 || state.lanes.length !== 1) {
		return {
			ok: false,
			exitCode: 1,
			error: "single_lane_required",
			output: "TP-015 resume supports exactly one task and one lane per batch.\n",
			batchId: state.batchId,
		};
	}

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const batchId = state.batchId;
	const baseBranch = state.baseBranch ?? "main";
	const orchBranch = state.orchBranch;
	const task = state.tasks[0];
	const lane = state.lanes[0];
	const taskId = task.taskId;
	const taskBranch = lane.branch ?? laneTaskBranch(batchId, 1);
	const wt = lane.worktreePath ?? laneWorktreePath(projectRoot, batchId, 1);

	if (!fs.existsSync(wt)) {
		return {
			ok: false,
			exitCode: 1,
			error: "worktree_missing",
			output: `Lane worktree not found: ${wt}\n`,
			batchId,
		};
	}

	const events = readJournalEvents(projectRoot, batchId);
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	const taskFolderRel = task.taskFolder
		? path.isAbsolute(task.taskFolder)
			? path.relative(projectRoot, task.taskFolder)
			: task.taskFolder
		: null;
	const taskFolderInWorktree = taskFolderRel
		? path.join(wt, taskFolderRel)
		: path.join(wt, "taskplane-tasks", `${taskId}-smoke`);

	const pendingSegments = countPendingSegments(state, taskId);
	const resumeForced = Boolean(force);

	const fromPhase = phase;
	if (phase === "failed" && force) {
		state.resilience = state.resilience ?? {};
		state.resilience.resumeForced = true;
		state.failedTasks = 0;
		if (task.status === "failed") {
			task.status = "pending";
			task.startedAt = null;
			task.endedAt = null;
			task.exitReason = null;
			task.doneFileFound = false;
			updateSegmentForTask(state, taskId, "pending");
		}
	}

	state.phase = "running";
	state.endedAt = null;
	state.lastError = null;
	saveSpineBatchState(projectRoot, state);
	recordPhaseTransition(projectRoot, batchId, fromPhase, "running", {
		resumeForced,
		pendingSegments,
		repairedLanes: [],
	});

	const laneCorrelationId = crypto.randomUUID();
	let workerResult = { ok: true, mode: "skipped" };

	if (taskAlreadyComplete({ taskFolder: taskFolderInWorktree, events, task })) {
		task.status = "succeeded";
		task.doneFileFound = true;
		task.exitReason = task.exitReason ?? "done";
		if (!task.endedAt) task.endedAt = Date.now();
		updateSegmentForTask(state, taskId, "succeeded");
		state.succeededTasks = 1;
		saveSpineBatchState(projectRoot, state);
	} else {
		task.status = "running";
		if (!task.startedAt) task.startedAt = Date.now();
		updateSegmentForTask(state, taskId, "running");
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.started", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: laneCorrelationId,
			resumed: true,
		});

		workerResult = await runWorker({
			worktreePath: wt,
			taskFolder: taskFolderInWorktree,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId,
			laneBranch: taskBranch,
			laneCorrelationId,
			config,
			onHeartbeat: (timestamp) => {
				state.lanes[0].lastHeartbeatAt = timestamp;
				saveSpineBatchState(projectRoot, state);
			},
			onWorkerPid: (pid) => {
				if (pid > 0) {
					state.lanes[0].workerPid = pid;
					saveSpineBatchState(projectRoot, state);
				}
			},
		});

		if (!workerResult.ok) {
			task.status = "failed";
			task.endedAt = Date.now();
			task.exitReason = workerResult.classification ?? "worker_failed";
			updateSegmentForTask(state, taskId, "failed");
			state.failedTasks = 1;
			state.succeededTasks = 0;
			state.endedAt = Date.now();
			state.lastError = workerResult.output?.slice(0, 500) ?? "worker failed";
			state.phase = "failed";
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: 1,
				laneId: "lane-1",
				correlationId: laneCorrelationId,
				...workerResult,
			});
			return {
				ok: false,
				exitCode: workerResult.exitCode ?? 1,
				batchId,
				taskId,
				error: "worker_failed",
				output: workerResult.output,
			};
		}

		appendJournalEvent(projectRoot, batchId, "lane.completed", {
			laneNumber: 1,
			laneId: "lane-1",
			taskId,
			correlationId: laneCorrelationId,
		});
		task.status = "succeeded";
		task.endedAt = Date.now();
		task.doneFileFound = true;
		task.exitReason = "done";
		updateSegmentForTask(state, taskId, "succeeded");
		state.succeededTasks = 1;
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: laneCorrelationId,
		});
	}

	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
	});
	if (!laneCommit.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = laneCommit.failureClass ?? "lane_commit_failed";
		updateSegmentForTask(state, taskId, "failed");
		state.failedTasks = 1;
		state.succeededTasks = 0;
		state.endedAt = Date.now();
		state.lastError = laneCommit.error ?? "lane commit failed";
		state.phase = "failed";
		saveSpineBatchState(projectRoot, state);
		return {
			ok: false,
			exitCode: 1,
			batchId,
			taskId,
			error: "lane_commit_failed",
			output: laneCommit.error,
		};
	}
	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber: 1,
			commitSha: laneCommit.commitSha,
		});
	}

	if (state.mergeResults?.length > 0) {
		state.endedAt = Date.now();
		state.phase = "completed";
		saveSpineBatchState(projectRoot, state);
		return {
			ok: true,
			exitCode: 0,
			batchId,
			taskId,
			output: `Batch ${batchId} already merged; marked completed.\n`,
		};
	}

	appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
		taskBranch,
		orchBranch,
	});
	const merge = mergeLaneToOrch({ projectRoot, baseBranch, orchBranch, taskBranch, batchId });
	if (!merge.ok) {
		state.endedAt = Date.now();
		state.lastError = merge.error ?? "merge failed";
		state.phase = "failed";
		saveSpineBatchState(projectRoot, state);
		return { ok: false, exitCode: 1, batchId, error: "merge_failed", output: merge.error };
	}

	state.mergeResults.push({
		waveIndex: 0,
		status: "succeeded",
		failedLane: null,
		failureReason: null,
		mergeCommit: merge.mergeCommit,
	});
	appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
		mergeCommit: merge.mergeCommit,
	});
	state.endedAt = Date.now();
	state.phase = "completed";
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "batch.completed", {
		taskId,
		mergeCommit: merge.mergeCommit,
		resumed: true,
	});

	return {
		ok: true,
		exitCode: 0,
		batchId,
		taskId,
		mergeCommit: merge.mergeCommit,
		output: `Batch ${batchId} resumed and completed: ${taskId} succeeded; merged to ${orchBranch}.\n  → spine batch complete\n`,
	};
}
