/**
 * Pending task filter — tasks without a terminal `.DONE` marker (FR-SCHED-06, TP-024).
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @param {Array<{ taskId: string, folderPath: string }>} discoveredTasks
 * @param {string} tasksRoot
 * @returns {string[]} Pending task IDs sorted lexicographically
 */
export function filterPendingTaskIds(discoveredTasks, tasksRoot) {
	const pending = [];

	for (const task of discoveredTasks) {
		const folderPath = task.folderPath ?? path.join(tasksRoot, `${task.taskId}-unknown`);
		const donePath = path.join(folderPath, ".DONE");
		if (!fs.existsSync(donePath)) {
			pending.push(task.taskId);
		}
	}

	return pending.sort();
}

/**
 * @param {Array<{ taskId: string, folderPath: string }>} discoveredTasks
 * @param {string} tasksRoot
 * @returns {{ pendingIds: string[], excludedCount: number }}
 */
export function summarizePendingScope(discoveredTasks, tasksRoot) {
	const allIds = discoveredTasks.map((task) => task.taskId);
	const pendingIds = filterPendingTaskIds(discoveredTasks, tasksRoot);
	return {
		pendingIds,
		excludedCount: allIds.length - pendingIds.length,
	};
}
