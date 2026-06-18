/**
 * Pending task filter — tasks without a terminal `.DONE` marker (FR-SCHED-06, TP-024).
 */

import fs from "node:fs";
import path from "node:path";
import { TASK_ID_RE } from "./scope.mjs";

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
		const supersededPath = path.join(folderPath, ".SUPERSEDED");
		if (!fs.existsSync(donePath) && !fs.existsSync(supersededPath)) {
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

/**
 * Parse replacement task IDs from a `.SUPERSEDED` marker body.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function parseSupersededReplacementIds(content) {
	const match = /Superseded by\s+([^\n]+)/i.exec(String(content ?? ""));
	if (!match) return [];

	return match[1]
		.split(/[,;]+/)
		.flatMap((segment) => segment.trim().split(/\s+/))
		.map((token) => token.trim())
		.filter((token) => TASK_ID_RE.test(token));
}

/**
 * Fail closed when explicit batch start requests superseded task IDs.
 *
 * @param {string[]} taskIds
 * @param {string} tasksRoot
 * @param {Array<{ taskId: string, folderPath: string }>} discoveredTasks
 * @param {{ forceSuperseded?: boolean }} [options]
 */
export function assertBatchStartTasksNotSuperseded(
	taskIds,
	tasksRoot,
	discoveredTasks,
	options = {},
) {
	if (options.forceSuperseded) {
		return { ok: true };
	}

	const folderById = new Map(
		discoveredTasks.map((task) => [
			task.taskId,
			task.folderPath ?? path.join(tasksRoot, `${task.taskId}-unknown`),
		]),
	);

	/** @type {Array<{ taskId: string, replacements: string[] }>} */
	const superseded = [];

	for (const taskId of taskIds) {
		const folderPath = folderById.get(taskId);
		if (!folderPath) continue;

		const supersededPath = path.join(folderPath, ".SUPERSEDED");
		if (!fs.existsSync(supersededPath)) continue;

		const content = fs.readFileSync(supersededPath, "utf-8");
		superseded.push({
			taskId,
			replacements: parseSupersededReplacementIds(content),
		});
	}

	if (superseded.length === 0) {
		return { ok: true };
	}

	const lines = [
		"Batch start rejected: requested task(s) are superseded (.SUPERSEDED marker present).",
		"",
	];

	for (const entry of superseded) {
		const replacementHint =
			entry.replacements.length > 0 ? ` → use ${entry.replacements.join(", ")}` : "";
		lines.push(`  ${entry.taskId}${replacementHint}`);
	}

	lines.push(
		"",
		"Prefer task IDs from: spine plan pending",
		"To rerun superseded tasks deliberately: spine batch start <ids> --force-superseded",
		"",
	);

	return {
		ok: false,
		error: "superseded_tasks",
		output: lines.join("\n"),
		supersededTaskIds: superseded.map((entry) => entry.taskId),
	};
}
