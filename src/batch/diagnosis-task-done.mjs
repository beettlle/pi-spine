/**
 * Per-task done-marker semantics for reconcile / status JSON (SP-344 / GitHub #35).
 */

import fs from "node:fs";
import path from "node:path";
import { laneWorktreePath } from "./worktree.mjs";

/** Documented task done-flag field names for status JSON. */
export const TASK_DONE_FLAG_FIELD_NAMES = ["doneFileFound", "doneOnMain", "doneInLane"];

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {string|null|undefined} taskFolder
 * @returns {string|null}
 */
export function resolveTaskFolderPath(tasksRoot, taskId, taskFolder) {
	if (taskFolder) {
		const direct = path.join(tasksRoot, taskFolder);
		if (fs.existsSync(direct)) return direct;
	}

	if (!tasksRoot || !fs.existsSync(tasksRoot)) return null;

	const match = fs
		.readdirSync(tasksRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(`${taskId}-`))
		.map((entry) => path.join(tasksRoot, entry.name))[0];

	return match ?? null;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {unknown[]} lanes
 * @param {object} task
 * @returns {string}
 */
export function resolveTaskLaneWorktreePath(projectRoot, batchId, lanes, task) {
	const laneNumber = Number(task.laneNumber ?? 1);
	const lane = Array.isArray(lanes)
		? lanes.find((entry) => Number(entry.laneNumber) === laneNumber)
		: null;
	if (lane && typeof lane.worktreePath === "string" && lane.worktreePath) {
		return path.isAbsolute(lane.worktreePath)
			? lane.worktreePath
			: path.join(projectRoot, lane.worktreePath);
	}
	return laneWorktreePath(projectRoot, batchId, laneNumber);
}

/**
 * @param {string|null} folderPath
 * @returns {boolean}
 */
function doneMarkerExists(folderPath) {
	return Boolean(folderPath && fs.existsSync(path.join(folderPath, ".DONE")));
}

/**
 * Classify per-task done semantics for reconcile / status JSON.
 *
 * - `doneFileFound`: batch-state / journal records worker completion.
 * - `doneOnMain`: `.DONE` exists under the integration checkout tasks root.
 * - `doneInLane`: `.DONE` exists in the lane worktree copy (pre-merge).
 *
 * @param {object} task
 * @param {object} ctx
 * @param {string|null} [ctx.tasksRoot]
 * @param {string} [ctx.projectRoot]
 * @param {string} [ctx.batchId]
 * @param {unknown[]} [ctx.lanes]
 */
export function classifyTaskDoneSemantics(task, ctx = {}) {
	const { tasksRoot, projectRoot, batchId, lanes = [] } = ctx;
	const mainFolderPath =
		tasksRoot && task.taskId
			? resolveTaskFolderPath(tasksRoot, task.taskId, task.taskFolder ?? null)
			: null;
	const doneOnMain = doneMarkerExists(mainFolderPath);
	const doneFileFound = Boolean(task.doneFileFound);

	let doneInLane = false;
	if (projectRoot && batchId && tasksRoot && task.taskId) {
		const laneWorktree = resolveTaskLaneWorktreePath(projectRoot, batchId, lanes, task);
		const tasksRootRel = path.relative(projectRoot, tasksRoot);
		const laneTasksRoot = path.join(laneWorktree, tasksRootRel);
		const laneFolderPath = resolveTaskFolderPath(
			laneTasksRoot,
			task.taskId,
			task.taskFolder ?? null,
		);
		doneInLane = doneMarkerExists(laneFolderPath);
	}

	let classification = task.classification;
	if (doneOnMain || doneInLane || doneFileFound) {
		classification = "terminal-success";
	}

	return {
		...task,
		doneFileFound,
		doneOnMain,
		doneInLane,
		classification,
	};
}
