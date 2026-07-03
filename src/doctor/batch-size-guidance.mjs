/**
 * Soft warnings when batch scope includes many M/L tasks (SP-087).
 */

import { discoverTasks } from "../tasks/packet/index.mjs";
import { parseTaskSizeFromFolder } from "../batch/task-stall-budget.mjs";
import { isStubWorkerMode } from "./stall-config.mjs";

const MEDIUM_LARGE_SIZES = new Set(["M", "L"]);
const WARN_AT_MEDIUM_LARGE_COUNT = 4;

/**
 * @param {object} params
 * @param {string} params.tasksRoot
 * @param {string[]} params.taskIds
 */
export function countMediumLargeTasks({ tasksRoot, taskIds }) {
	const discovered = discoverTasks(tasksRoot);
	const folderById = Object.fromEntries(discovered.map((task) => [task.taskId, task.folderPath]));

	/** @type {string[]} */
	const mediumLargeTaskIds = [];
	let mCount = 0;
	let lCount = 0;
	for (const taskId of taskIds) {
		const folderPath = folderById[taskId];
		if (!folderPath) continue;
		const size = parseTaskSizeFromFolder(folderPath);
		if (size && MEDIUM_LARGE_SIZES.has(size)) {
			mediumLargeTaskIds.push(taskId);
			if (size === "M") mCount++;
			else if (size === "L") lCount++;
		}
	}

	return {
		count: mediumLargeTaskIds.length,
		taskIds: mediumLargeTaskIds,
		mCount,
		lCount,
	};
}

/**
 * @param {object} params
 * @param {string} params.tasksRoot
 * @param {string[]} params.taskIds
 * @returns {string|null}
 */
/**
 * Format the size label portion of the guidance warning based on actual M/L composition.
 * @param {number} mCount
 * @param {number} lCount
 * @returns {string}
 */
function formatSizeLabel(mCount, lCount) {
	if (mCount > 0 && lCount > 0) {
		return `${mCount} M and ${lCount} L task(s)`;
	}
	if (mCount > 0) {
		return `${mCount} M task(s)`;
	}
	return `${lCount} L task(s)`;
}

/**
 * @param {object} params
 * @param {string} params.tasksRoot
 * @param {string[]} params.taskIds
 * @returns {string|null}
 */
export function buildBatchSizeGuidanceWarning({ tasksRoot, taskIds }) {
	if (isStubWorkerMode()) return null;

	const { count, taskIds: mediumLargeTaskIds, mCount, lCount } = countMediumLargeTasks({ tasksRoot, taskIds });
	if (count < WARN_AT_MEDIUM_LARGE_COUNT) return null;

	const preview = mediumLargeTaskIds.slice(0, 6).join(", ");
	const suffix = mediumLargeTaskIds.length > 6 ? ", ..." : "";

	return (
		`⚠ Batch includes ${formatSizeLabel(mCount, lCount)} (${preview}${suffix}) — ` +
		"prefer smaller batches for real pi workers; set lanes.stallTimeoutMinutes ≥120"
	);
}

/**
 * @param {string} planText
 * @param {{ scope?: { taskIds?: string[] }, metadata?: { tasksRoot?: string } }} plan
 */
export function appendBatchSizeGuidanceToPlanOutput(planText, plan) {
	const tasksRoot = plan.metadata?.tasksRoot;
	const taskIds = plan.scope?.taskIds ?? [];
	if (!tasksRoot || taskIds.length === 0) return planText;

	const warning = buildBatchSizeGuidanceWarning({ tasksRoot, taskIds });
	if (!warning) return planText;

	return `${planText.trimEnd()}\n\n${warning}\n`;
}
