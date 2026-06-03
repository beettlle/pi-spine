/**
 * Multi-task batch resume validation (TP-039) and execution (TP-040).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { DEFAULT_TASKS_ROOT } from "../../bin/spine-init.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { loadTaskPacket } from "../tasks/packet/index.mjs";
import { assessWaveMergeEligibility, mergeLaneToOrch } from "./engine.mjs";
import { openIntegrateGateAfterBatchComplete } from "./gate.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { commitLaneWorktree, gitPorcelain } from "./lane-commit.mjs";
import { detectSegmentDrift } from "./retry.mjs";
import {
	countPendingSegments,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
	updateSegmentForTask,
	validateBatchState,
} from "./state.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";

/**
 * @param {object} state
 * @param {object} task
 */
function isTaskResumable(state, task) {
	const status = String(task.status ?? "").toLowerCase();
	if (status === "pending" || status === "running") return true;

	return (state.segments ?? []).some((segment) => {
		if (!segment || segment.taskId !== task.taskId) return false;
		const segmentStatus = String(segment.status ?? "").toLowerCase();
		return segmentStatus === "pending" || segmentStatus === "running";
	});
}

/**
 * @param {object} state
 */
export function computePendingTasks(state) {
	return (state.tasks ?? []).filter((task) => task && isTaskResumable(state, task));
}

/**
 * @param {object} state
 * @param {object[]} pendingTasks
 */
export function findResumableWave(state, pendingTasks) {
	const pendingIds = new Set(pendingTasks.map((task) => task.taskId));
	const wavePlan = state.wavePlan ?? [];

	for (let waveIndex = 0; waveIndex < wavePlan.length; waveIndex++) {
		const waveTaskIds = wavePlan[waveIndex] ?? [];
		if (waveTaskIds.some((taskId) => pendingIds.has(taskId))) {
			return waveIndex;
		}
	}

	return Number(state.currentWaveIndex ?? 0);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 */
export function validateMultiTaskResume({ projectRoot, force = false }) {
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

	const tasks = state.tasks ?? [];
	const lanes = state.lanes ?? [];
	if (tasks.length < 1 || lanes.length < 1) {
		return {
			ok: false,
			exitCode: 1,
			error: "no_tasks_or_lanes",
			output: "Batch must have at least one task and one lane to resume.\n",
			batchId: state.batchId,
		};
	}

	const batchId = state.batchId;
	for (const lane of lanes) {
		const laneNumber = Number(lane.laneNumber ?? 1);
		const wt = lane.worktreePath ?? laneWorktreePath(projectRoot, batchId, laneNumber);
		if (!fs.existsSync(wt)) {
			return {
				ok: false,
				exitCode: 1,
				error: "worktree_missing",
				output: `Lane ${laneNumber} worktree not found: ${wt}\n`,
				batchId,
				laneNumber,
			};
		}
	}

	const pendingTasks = computePendingTasks(state);
	if (pendingTasks.length < 1) {
		return {
			ok: false,
			exitCode: 1,
			error: "no_pending_tasks",
			output: "No pending tasks to resume.\n",
			batchId: state.batchId,
		};
	}

	const resumableWave = findResumableWave(state, pendingTasks);

	return {
		ok: true,
		batchId,
		phase,
		updatedAt: Number(state.updatedAt ?? 0),
		pendingTasks,
		lanes,
		resumableWave,
	};
}

/**
 * @param {object} state
 */
function recomputeTaskCounters(state) {
	const tasks = state.tasks ?? [];
	state.succeededTasks = tasks.filter((task) => task?.status === "succeeded").length;
	state.failedTasks = tasks.filter((task) => task?.status === "failed").length;
	state.skippedTasks = tasks.filter((task) => task?.status === "skipped").length;
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
 */
function resolveTaskFolderInWorktree({ projectRoot, task, lane, tasksRootRel = DEFAULT_TASKS_ROOT }) {
	const taskFolderRel = task.taskFolder
		? path.isAbsolute(task.taskFolder)
			? path.relative(projectRoot, task.taskFolder)
			: task.taskFolder
		: null;
	const wt = lane.worktreePath ?? laneWorktreePath(projectRoot, lane.batchId ?? "", lane.laneNumber);
	return taskFolderRel
		? path.join(wt, taskFolderRel)
		: path.join(wt, tasksRootRel, `${task.taskId}-smoke`);
}

/**
 * @param {object} params
 */
function recordBatchResumed(projectRoot, batchId, fromPhase, extra = {}) {
	if (fromPhase === "paused" || (fromPhase === "failed" && extra.resumeForced)) {
		appendJournalEvent(projectRoot, batchId, "batch.resumed", {
			fromPhase,
			toPhase: "running",
			...extra,
		});
	}
}

/**
 * @param {object} params
 */
function resetFailedTasksForForceResume({ state, pendingTasks }) {
	state.resilience = state.resilience ?? {};
	state.resilience.resumeForced = true;
	state.failedTasks = 0;

	for (const task of pendingTasks) {
		if (task.status !== "failed") continue;
		task.status = "pending";
		task.startedAt = null;
		task.endedAt = null;
		task.exitReason = null;
		task.doneFileFound = false;
		updateSegmentForTask(state, task.taskId, "pending");
	}
}

/**
 * @param {object} params
 */
async function markTaskCompleteFromDisk({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	taskFolderInWorktree,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;

	task.status = "succeeded";
	task.doneFileFound = true;
	task.exitReason = task.exitReason ?? "done";
	if (!task.endedAt) task.endedAt = Date.now();
	updateSegmentForTask(state, taskId, "succeeded");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);

	if (!journalHasTaskCompleted(readJournalEvents(projectRoot, batchId), taskId)) {
		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			resumed: true,
			skippedDoneOnDisk: true,
			taskFolder: taskFolderInWorktree,
		});
	}

	return { ok: true, skipped: true };
}

/**
 * @param {object} params
 */
async function runResumedTaskOnLane({
	projectRoot,
	state,
	batchId,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranch = lane.branch ?? laneTaskBranch(batchId, laneNumber);
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	let fileScopePaths = [];
	try {
		const packet = loadTaskPacket(path.join(projectRoot, taskFolderRel));
		fileScopePaths = packet.prompt?.fileScope ?? [];
	} catch {
		fileScopePaths = [];
	}

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		resumed: true,
	});

	const workerResult = await runWorker({
		worktreePath: wt,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneBranch: taskBranch,
		laneCorrelationId,
		fileScopePaths,
		config,
		onHeartbeat: (timestamp) => {
			lane.lastHeartbeatAt = timestamp;
			saveSpineBatchState(projectRoot, state);
		},
		onWorkerPid: (pid) => {
			if (pid > 0) {
				lane.workerPid = pid;
				saveSpineBatchState(projectRoot, state);
			}
		},
	});

	if (!workerResult.ok) {
		const aborted = workerResult.classification === "aborted";
		appendJournalEvent(projectRoot, batchId, "lane.died", {
			laneNumber,
			laneId: lane.laneId,
			taskId,
			correlationId: laneCorrelationId,
			reason: workerResult.classification ?? "worker_failed",
		});
		task.status = aborted ? "aborted" : "failed";
		task.endedAt = Date.now();
		task.exitReason = workerResult.classification ?? "worker_failed";
		updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		if (!aborted) {
			const salvageFields = recordTaskFailureSalvage({
				projectRoot,
				batchId,
				laneNumber,
				laneId: lane.laneId,
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
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				...workerResult,
				...salvageFields,
			});
		}
		return { ok: false, aborted, workerResult, taskId, laneNumber };
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});
	task.status = "succeeded";
	task.endedAt = Date.now();
	task.doneFileFound = true;
	task.exitReason = "done";
	updateSegmentForTask(state, taskId, "succeeded");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.completed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
	});

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
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
			taskId,
			laneNumber,
		};
	}
	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber,
			commitSha: laneCommit.commitSha,
		});
	}

	const remainingDirty = gitPorcelain(wt);
	if (remainingDirty) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "DirtyWorktree";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output:
				"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output",
			taskId,
			laneNumber,
		};
	}

	return { ok: true, taskId, laneNumber };
}

/**
 * @param {object} params
 */
async function mergeWaveLanesToOrch({
	projectRoot,
	state,
	batchId,
	baseBranch,
	orchBranch,
	waveIndex,
}) {
	const lanes = state.lanes ?? [];
	let lastMergeCommit = null;

	for (const lane of lanes) {
		const laneNumber = lane.laneNumber;
		const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
		const laneSucceeded = waveTaskIds.some((taskId) => {
			const entry = (state.tasks ?? []).find((task) => task?.taskId === taskId);
			return entry && entry.laneNumber === laneNumber && entry.status === "succeeded";
		});
		if (!laneSucceeded) continue;

		const taskBranch = lane.branch ?? laneTaskBranch(batchId, laneNumber);
		appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
			taskBranch,
			orchBranch,
			laneNumber,
			waveIndex,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch,
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: false,
		});
		if (!merge.ok) {
			return { ok: false, error: merge.error ?? "merge_failed", laneNumber };
		}
		lastMergeCommit = merge.mergeCommit;
		appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
			mergeCommit: merge.mergeCommit,
			laneNumber,
			waveIndex,
		});
	}

	state.mergeResults = state.mergeResults ?? [];
	state.mergeResults.push({
		waveIndex,
		status: "succeeded",
		failedLane: null,
		failureReason: null,
		mergeCommit: lastMergeCommit,
	});
	saveSpineBatchState(projectRoot, state);

	return { ok: true, mergeCommit: lastMergeCommit };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 * @param {object} [params.resumeCheck]
 */
export async function resumeMultiTaskBatch({ projectRoot, force = false, resumeCheck = null }) {
	const check = resumeCheck ?? validateMultiTaskResume({ projectRoot, force });
	if (!check.ok) {
		return check;
	}

	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	const batchId = state.batchId;
	const baseBranch = state.baseBranch ?? "main";
	const orchBranch = state.orchBranch;
	const resumeForced = Boolean(force);
	const fromPhase = phase;

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const tasksRootRel = config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT;
	resolveTasksRoot(projectRoot, configResult);

	if (phase === "failed" && force) {
		resetFailedTasksForForceResume({ state, pendingTasks: check.pendingTasks });
	}

	const pendingSegments = countPendingSegments(state);

	state.phase = "running";
	state.endedAt = null;
	state.lastError = null;
	recordBatchEnginePid(state, process.pid);
	saveSpineBatchState(projectRoot, state);
	recordBatchResumed(projectRoot, batchId, fromPhase, {
		resumeForced,
		pendingSegments,
		repairedLanes: [],
		pendingTaskIds: check.pendingTasks.map((task) => task.taskId),
		resumableWave: check.resumableWave,
	});

	const events = readJournalEvents(projectRoot, batchId);
	let batchAborted = false;
	const startWave = check.resumableWave ?? 0;
	const wavePlan = state.wavePlan ?? [];

	for (let waveIndex = startWave; waveIndex < wavePlan.length; waveIndex++) {
		state.currentWaveIndex = waveIndex;
		saveSpineBatchState(projectRoot, state);

		const waveTaskIds = wavePlan[waveIndex] ?? [];
		/** @type {Promise<{ ok: boolean, aborted?: boolean, taskId?: string, laneNumber?: number, error?: string, output?: string }>[]} */
		const waveRuns = [];

		for (const taskId of waveTaskIds) {
			const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
			if (!task) continue;

			const lane = (state.lanes ?? []).find((entry) => entry.laneNumber === task.laneNumber);
			if (!lane) {
				return {
					ok: false,
					exitCode: 1,
					batchId,
					taskId,
					error: "lane_not_found",
					output: `No lane assigned for task ${taskId} (lane ${task.laneNumber}).\n`,
				};
			}

			const taskFolderRel = task.taskFolder
				? path.isAbsolute(task.taskFolder)
					? path.relative(projectRoot, task.taskFolder)
					: task.taskFolder
				: path.join(tasksRootRel, `${taskId}-smoke`);
			const taskFolderInWorktree = resolveTaskFolderInWorktree({ projectRoot, task, lane, tasksRootRel });
			const laneCorrelationId = lane.correlationId ?? crypto.randomUUID();
			lane.correlationId = laneCorrelationId;

			if (taskAlreadyComplete({ taskFolder: taskFolderInWorktree, events, task })) {
				waveRuns.push(
					markTaskCompleteFromDisk({
						projectRoot,
						state,
						batchId,
						task,
						lane,
						taskFolderInWorktree,
						laneCorrelationId,
					}),
				);
				continue;
			}

			if (!isTaskResumable(state, task)) {
				continue;
			}

			waveRuns.push(
				runResumedTaskOnLane({
					projectRoot,
					state,
					batchId,
					config,
					task,
					lane,
					taskFolderRel,
					laneCorrelationId,
				}).then((result) => {
					if (result.aborted) batchAborted = true;
					return result;
				}),
			);
		}

		const waveResults = await Promise.all(waveRuns);
		if (batchAborted) {
			const abortedTask = state.tasks.find((task) => task.status === "aborted");
			state.endedAt = Date.now();
			state.lastError = "batch aborted";
			state.phase = "aborted";
			saveSpineBatchState(projectRoot, state);
			return {
				ok: false,
				exitCode: 1,
				batchId,
				error: "aborted",
				taskId: abortedTask?.taskId,
				output: "Batch aborted.\n",
			};
		}

		const failed = waveResults.filter((result) => !result.ok);
		if (failed.length > 0) {
			const first = failed[0];
			state.endedAt = Date.now();
			state.lastError = first.output?.slice(0, 500) ?? first.error ?? "worker failed";
			state.phase = "failed";
			saveSpineBatchState(projectRoot, state);
			return {
				ok: false,
				exitCode: 1,
				batchId,
				taskId: first.taskId,
				error: first.error ?? "worker_failed",
				output: first.output ?? state.lastError,
			};
		}

		const alreadyMerged = (state.mergeResults ?? []).some(
			(entry) => entry.waveIndex === waveIndex && entry.status === "succeeded",
		);
		if (alreadyMerged) {
			continue;
		}

		const mergeEligibility = assessWaveMergeEligibility(state, waveIndex);
		if (!mergeEligibility.ok) {
			state.endedAt = Date.now();
			state.lastError = mergeEligibility.message?.slice(0, 500) ?? "mixed_outcome";
			state.phase = "failed";
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "batch.merge_blocked", {
				waveIndex,
				failedTaskIds: mergeEligibility.failedTaskIds,
				pendingTaskIds: mergeEligibility.pendingTaskIds,
			});
			return {
				ok: false,
				exitCode: 1,
				batchId,
				error: "mixed_outcome_merge_blocked",
				failedTaskIds: mergeEligibility.failedTaskIds,
				output: `${mergeEligibility.message}\n`,
			};
		}

		const mergeResult = await mergeWaveLanesToOrch({
			projectRoot,
			state,
			batchId,
			baseBranch,
			orchBranch,
			waveIndex,
		});
		if (!mergeResult.ok) {
			state.endedAt = Date.now();
			state.lastError = mergeResult.error ?? "merge failed";
			state.phase = "failed";
			saveSpineBatchState(projectRoot, state);
			return {
				ok: false,
				exitCode: 1,
				batchId,
				error: "merge_failed",
				output: mergeResult.error,
			};
		}
	}

	state.endedAt = Date.now();
	state.phase = "completed";
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "batch.completed", {
		taskIds: (state.tasks ?? []).map((task) => task.taskId),
		mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
		resumed: true,
	});
	openIntegrateGateAfterBatchComplete({ projectRoot, batchId, batchState: state });

	const taskIds = (state.tasks ?? []).map((task) => task.taskId);
	const summaryTask =
		taskIds.length === 1 ? taskIds[0] : `${taskIds.length} tasks (${taskIds.join(", ")})`;

	return {
		ok: true,
		exitCode: 0,
		batchId,
		taskIds,
		taskId: taskIds.length === 1 ? taskIds[0] : undefined,
		mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
		output:
			`Batch ${batchId} resumed and completed: ${summaryTask} succeeded; merged to ${orchBranch}.\n` +
			`  → spine gate approve\n  → spine integrate\n  → spine batch complete\n`,
	};
}
