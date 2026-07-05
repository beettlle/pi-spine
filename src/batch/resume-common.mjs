/**
 * Shared resume validation and task-path helpers (SP-076).
 */

import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TASKS_ROOT } from "../config/spine-init-constants.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { recomputeTaskCounters } from "./state.mjs";
import { loadTaskFileScopePaths } from "./engine-lanes.mjs";
import { laneWorktreePath } from "./worktree.mjs";

/**
 * @param {object} state
 */
export { recomputeTaskCounters };

/**
 * @param {object[]} events
 * @param {string} taskId
 */
export function journalHasTaskCompleted(events, taskId) {
	return events.some((event) => event.type === "task.completed" && event.taskId === taskId);
}

/**
 * @param {object[]} events
 * @param {string} taskId
 */
export function journalHasLaneCommitted(events, taskId) {
	return events.some((event) => event.type === "lane.committed" && event.taskId === taskId);
}

/**
 * Task finished the full resume pipeline (journal + batch-state) — safe to skip on resume.
 *
 * @param {object} params
 */
export function taskTerminalSuccessInBatch({ events, task, taskFolder }) {
	const taskId = task?.taskId;
	if (!taskId) return false;

	const status = String(task?.status ?? "").toLowerCase();
	if (status !== "succeeded" && status !== "skipped") return false;
	if (!journalHasTaskCompleted(events, taskId)) return false;

	if (journalHasLaneCommitted(events, taskId)) return true;
	if (task.doneFileFound) return true;

	return fs.existsSync(path.join(taskFolder, ".DONE"));
}

/**
 * @param {object} params
 */
export function taskAlreadyComplete({ taskFolder, events, task }) {
	const status = String(task?.status ?? "");
	if (status === "failed") {
		return false;
	}
	const doneOnDisk = fs.existsSync(path.join(taskFolder, ".DONE"));
	if (doneOnDisk && (status === "running" || status === "pending")) {
		return true;
	}
	if (status === "pending" || status === "running") {
		return false;
	}
	return (
		doneOnDisk ||
		task.doneFileFound ||
		status === "succeeded" ||
		journalHasTaskCompleted(events, task.taskId)
	);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} fromPhase
 * @param {string} toPhase
 * @param {object} [extra]
 */
export function recordResumePhaseTransition(projectRoot, batchId, fromPhase, toPhase, extra = {}) {
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
 * @param {object} task
 * @param {string} projectRoot
 */
export function resolveTaskFolderRel(task, projectRoot) {
	if (!task.taskFolder) return null;
	return path.isAbsolute(task.taskFolder)
		? path.relative(projectRoot, task.taskFolder)
		: task.taskFolder;
}

/**
 * @param {object} params
 */
export function resolveTaskFolderInWorktree({
	projectRoot,
	task,
	lane,
	tasksRootRel = DEFAULT_TASKS_ROOT,
	batchId,
}) {
	const taskFolderRel = resolveTaskFolderRel(task, projectRoot);
	const laneNumber = Number(lane.laneNumber ?? 1);
	const wt =
		lane.worktreePath ?? laneWorktreePath(projectRoot, batchId ?? "", laneNumber);
	return taskFolderRel
		? path.join(wt, taskFolderRel)
		: path.join(wt, tasksRootRel, `${task.taskId}-smoke`);
}

/**
 * @param {string} projectRoot
 * @param {string|null} taskFolderRel
 * @param {string} tasksRootRel
 * @param {string} taskId
 */
export function resolveTaskFolderOnHost(projectRoot, taskFolderRel, tasksRootRel, taskId) {
	return path.join(projectRoot, taskFolderRel ?? path.join(tasksRootRel, `${taskId}-smoke`));
}

/**
 * @param {string} taskFolderOnHost
 */
export function loadResumeFileScopePaths(taskFolderOnHost) {
	return loadTaskFileScopePaths(taskFolderOnHost);
}
