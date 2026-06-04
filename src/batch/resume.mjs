/**
 * Batch pause and resume for single-lane batches (TP-015, PRD §18.2).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { DEFAULT_TASKS_ROOT } from "../../bin/spine-init.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { openIntegrateGateAfterBatchComplete } from "./gate.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { commitLaneWorktree } from "./lane-commit.mjs";
import { mergeLaneToOrch } from "./engine-lanes.mjs";
import {
	loadResumeFileScopePaths,
	recordResumePhaseTransition,
	resolveTaskFolderOnHost,
	resolveTaskFolderRel,
	taskAlreadyComplete,
} from "./resume-common.mjs";
import {
	countPendingSegments,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";
import { validateMultiTaskResume, resumeMultiTaskBatch } from "./resume-multi.mjs";
import { runWorker } from "./worker-host.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";

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
	recordResumePhaseTransition(projectRoot, state.batchId, fromPhase, "paused");

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		phase: "paused",
		output: `Batch ${state.batchId} paused. No new tasks will be scheduled.\n  → spine batch resume\n`,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 */
export function validateResumeBatch({ projectRoot, force = false }) {
	const result = validateMultiTaskResume({ projectRoot, force });
	if (!result.ok) {
		return result;
	}

	const taskId = result.pendingTasks.length === 1 ? result.pendingTasks[0].taskId : undefined;

	return {
		...result,
		taskId,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 */
export async function resumeBatch({ projectRoot, force = false }) {
	const resumeCheck = validateResumeBatch({ projectRoot, force });
	if (!resumeCheck.ok) {
		return resumeCheck;
	}

	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	const tasks = state.tasks ?? [];
	const lanes = state.lanes ?? [];

	if (tasks.length > 1 || lanes.length > 1) {
		return resumeMultiTaskBatch({ projectRoot, force, resumeCheck });
	}

	const phase = String(state.phase ?? "");

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
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	const taskFolderRel = resolveTaskFolderRel(task, projectRoot);
	const tasksRootRel = config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT;
	const taskFolderInWorktree = taskFolderRel
		? path.join(wt, taskFolderRel)
		: path.join(wt, tasksRootRel, `${taskId}-smoke`);

	const taskFolderOnHost = resolveTaskFolderOnHost(projectRoot, taskFolderRel, tasksRootRel, taskId);
	const scopeResult = loadResumeFileScopePaths(taskFolderOnHost);
	if (!scopeResult.ok) {
		const laneCorrelationId = crypto.randomUUID();
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "prompt_parse_failed";
		if (!task.startedAt) task.startedAt = Date.now();
		updateSegmentForTask(state, taskId, "failed");
		state.failedTasks = 1;
		state.succeededTasks = 0;
		state.endedAt = Date.now();
		state.lastError = scopeResult.error?.slice(0, 500) ?? "prompt parse failed";
		state.phase = "failed";
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.prompt_parse_failed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: laneCorrelationId,
			error: scopeResult.error,
			errors: scopeResult.errors,
			promptPath: scopeResult.promptPath,
			resumed: true,
		});
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: laneCorrelationId,
			classification: "prompt_parse_failed",
			exitCode: 1,
			output: scopeResult.error,
			resumed: true,
		});
		return {
			ok: false,
			exitCode: 1,
			batchId,
			taskId,
			error: "prompt_parse_failed",
			output: scopeResult.error,
		};
	}
	const fileScopePaths = scopeResult.fileScopePaths;

	const events = readJournalEvents(projectRoot, batchId);
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
	recordBatchEnginePid(state, process.pid);
	saveSpineBatchState(projectRoot, state);
	recordResumePhaseTransition(projectRoot, batchId, fromPhase, "running", {
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
			fileScopePaths,
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
			const salvageFields = recordTaskFailureSalvage({
				projectRoot,
				batchId,
				laneNumber: 1,
				laneId: "lane-1",
				taskId,
				correlationId: laneCorrelationId,
				worktreePath: wt,
				fileScopePaths,
				taskFolder: taskFolderInWorktree,
				workerResult,
				config,
				batchPhase: state.phase,
				taskBranch,
			});
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: 1,
				laneId: "lane-1",
				correlationId: laneCorrelationId,
				...workerResult,
				...salvageFields,
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
	openIntegrateGateAfterBatchComplete({ projectRoot, batchId, batchState: state });

	return {
		ok: true,
		exitCode: 0,
		batchId,
		taskId,
		mergeCommit: merge.mergeCommit,
		output:
			`Batch ${batchId} resumed and completed: ${taskId} succeeded; merged to ${orchBranch}.\n` +
			`  → spine gate approve\n  → spine integrate\n  → spine batch complete\n`,
	};
}
