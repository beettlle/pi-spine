// @ts-nocheck
/**
 * Batch pause and resume for single-lane batches (TP-015, PRD §18.2).
 * Single-owner gate is enforceAttachedEngineSingleOwner (SP-660 / #207).
 */

import path from "node:path";
import crypto from "node:crypto";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { DEFAULT_TASKS_ROOT } from "../config/spine-init-constants.mjs";
import { installAttachedEngineShutdownHandlers } from "./attached-engine-handoff.mjs";
import { enforceAttachedEngineSingleOwner, finalizeResumePostMergeLimbo } from "./attached-runner.mjs";
import { ensureForceResumeBatchState } from "./batch-meta-reconstruct.mjs";
import { openIntegrateGateAfterBatchComplete } from "./gate.mjs";
import { finalizeResumedBatchForIntegrate, isPostMergeLimbo } from "./post-merge-limbo.mjs";
import { prepareOrphanResumeHandoff } from "./resume-engine.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { commitLaneWorktree, filterPorcelain, gitPorcelain } from "./lane-commit.mjs";
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
	refreshLaneHeartbeatsOnResume,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";
import { resumeMultiTaskBatch } from "./resume-multi.mjs";
import { runLaneReviewPhasesBeforeCommit } from "./resume-lane-reviews.mjs";
import { validateResumeBatch } from "./resume-single-validate.mjs";
import { runWorker } from "./worker-host.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";

export { pauseBatch } from "./pause.mjs";
export { validateResumeBatch } from "./resume-single-validate.mjs";
export { ensureForceResumeBatchState } from "./batch-meta-reconstruct.mjs";

/** @param {{ projectRoot: string, force?: boolean }} params */
export async function resumeBatch({ projectRoot, force = false }) {
	const engineLock = enforceAttachedEngineSingleOwner({ projectRoot, force, operation: "resume" });
	if (!engineLock.ok) {
		return engineLock;
	}
	const releaseResumeLock = engineLock.releaseResumeLock;

	// SP-620 / #126: reconstruct from batch-meta when live state is missing/corrupt.
	if (force) {
		const ensured = ensureForceResumeBatchState(projectRoot, { force: true });
		if (!ensured.ok && ensured.attempted) {
			releaseResumeLock?.();
			return ensured;
		}
	}

	const resumeCheck = validateResumeBatch({ projectRoot, force });
	if (!resumeCheck.ok) {
		releaseResumeLock?.();
		return resumeCheck;
	}

	installAttachedEngineShutdownHandlers({ projectRoot });

	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	const tasks = state.tasks ?? [];
	const lanes = state.lanes ?? [];

	if (tasks.length > 1 || lanes.length > 1) {
		try {
			return await resumeMultiTaskBatch({ projectRoot, force, resumeCheck });
		} finally {
			releaseResumeLock?.();
		}
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
		releaseResumeLock?.();
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

	if (isPostMergeLimbo(state) && task.status === "succeeded") {
		const finalizeResult = finalizeResumePostMergeLimbo({
			projectRoot,
			state,
			batchId,
			orchBranch,
			fromPhase: phase,
			resumeForced: Boolean(force),
		});
		if (finalizeResult) {
			releaseResumeLock?.();
			return finalizeResult;
		}
	}

	prepareOrphanResumeHandoff({
		projectRoot,
		state,
		batchId,
		fromPhase: phase,
		orphanResume: resumeCheck.orphanResume,
		engineConfirmedDead: resumeCheck.engineConfirmedDead,
	});

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
	refreshLaneHeartbeatsOnResume(state);
	saveSpineBatchState(projectRoot, state);
	releaseResumeLock?.();
	recordResumePhaseTransition(projectRoot, batchId, fromPhase, "running", {
		resumeForced,
		pendingSegments,
		repairedLanes: [],
	});

	const laneCorrelationId = crypto.randomUUID();
	let workerResult = { ok: true, mode: "skipped" };
	let workerSucceeded = false;
	const skippedWorkerBecauseComplete = taskAlreadyComplete({
		taskFolder: taskFolderInWorktree,
		events,
		task,
	});

	if (skippedWorkerBecauseComplete) {
		workerSucceeded = true;
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
		workerSucceeded = true;
	}

	if (workerSucceeded) {
		const lane =
			(state.lanes ?? []).find((entry) => entry.laneNumber === 1) ??
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: taskBranch,
			};

		const reviewResult = await runLaneReviewPhasesBeforeCommit({
			projectRoot,
			state,
			batchId,
			config,
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch,
			laneCorrelationId,
			fileScopePaths,
			baseBranch,
		});
		if (!reviewResult.ok) {
			return {
				ok: false,
				exitCode: reviewResult.exitCode ?? 1,
				batchId,
				taskId,
				error: reviewResult.error ?? "review_failed",
				output: reviewResult.output,
			};
		}

		const ignorePatterns = Array.isArray(config?.worktreeSetupIgnorePaths)
			? config.worktreeSetupIgnorePaths
			: [];
		const laneCommit = commitLaneWorktree({
			worktreePath: wt,
			taskBranch,
			taskId,
			batchId,
			taskFolder: taskFolderInWorktree,
			projectRoot,
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
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: 1,
				laneId: "lane-1",
				correlationId: laneCorrelationId,
				classification: laneCommit.failureClass ?? "lane_commit_failed",
				exitCode: 1,
				output: laneCommit.error,
				resumed: true,
			});
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

		const remainingDirty = filterPorcelain(gitPorcelain(wt), ignorePatterns);
		if (remainingDirty) {
			const dirtyOutput =
				"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output";
			task.status = "failed";
			task.endedAt = Date.now();
			task.exitReason = "DirtyWorktree";
			updateSegmentForTask(state, taskId, "failed");
			state.failedTasks = 1;
			state.succeededTasks = 0;
			state.endedAt = Date.now();
			state.lastError = dirtyOutput;
			state.phase = "failed";
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: 1,
				laneId: "lane-1",
				correlationId: laneCorrelationId,
				classification: "DirtyWorktree",
				exitCode: 1,
				output: dirtyOutput,
				resumed: true,
			});
			return {
				ok: false,
				exitCode: 1,
				batchId,
				taskId,
				error: "dirty_after_lane_commit",
				output: dirtyOutput,
			};
		}

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
			resumed: true,
		});
	}

	if (state.mergeResults?.length > 0) {
		return finalizeResumedBatchForIntegrate({
			projectRoot,
			state,
			batchId,
			orchBranch,
			resumeForced: Boolean(force),
		});
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
	openIntegrateGateAfterBatchComplete({
		projectRoot,
		batchId,
		batchState: { ...state, phase: "completed" },
	});
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
		output:
			`Batch ${batchId} resumed and completed: ${taskId} succeeded; merged to ${orchBranch}.\n` +
			`  → spine gate approve\n  → spine integrate\n  → spine batch complete\n`,
	};
}
