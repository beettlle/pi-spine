// @ts-nocheck
/**
 * Per-lane queue wiring for multi-task resume waves (extracted from resume-multi-lanes.mjs).
 */

import path from "node:path";
import crypto from "node:crypto";
import {
	resolveTaskFolderInWorktree,
	taskAlreadyComplete,
	taskTerminalSuccessInBatch,
} from "./resume-common.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { laneTaskBranch } from "./worktree.mjs";
import { isTaskResumable } from "./resume-multi-validate.mjs";
import {
	markTaskCompleteFromDisk,
	runResumedTaskOnLane,
} from "./resume-multi-lanes.mjs";

/**
 * Build lane queues and run all tasks in a resume wave.
 *
 * @param {object} params
 * @returns {Promise<{ ok: true, waveResults: object[], batchAborted: boolean } | { ok: false, result: object }>}
 */
export async function executeResumeWave({
	projectRoot,
	state,
	batchId,
	config,
	tasksRootRel,
	waveIndex,
	waveTaskIds,
	events,
}) {
	/** @type {Map<number, { lane: object, runs: Array<{ taskId: string, run: () => Promise<object> }> }>} */
	const runsByLane = new Map();
	let batchAborted = false;

	for (const taskId of waveTaskIds) {
		const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
		if (!task) continue;

		const laneNumber = task.laneNumber;
		const lane = (state.lanes ?? []).find((entry) => entry.laneNumber === laneNumber);
		if (!lane) {
			return {
				ok: false,
				result: {
					ok: false,
					exitCode: 1,
					batchId,
					taskId,
					error: "lane_not_found",
					output: `No lane assigned for task ${taskId} (lane ${laneNumber}).\n`,
				},
			};
		}

		const taskFolderRel = task.taskFolder
			? path.isAbsolute(task.taskFolder)
				? path.relative(projectRoot, task.taskFolder)
				: task.taskFolder
			: path.join(tasksRootRel, `${taskId}-smoke`);
		const taskFolderInWorktree = resolveTaskFolderInWorktree({
			projectRoot,
			task,
			lane,
			tasksRootRel,
			batchId,
		});
		const laneCorrelationId = lane.correlationId ?? crypto.randomUUID();
		lane.correlationId = laneCorrelationId;

		if (!runsByLane.has(laneNumber)) {
			runsByLane.set(laneNumber, { lane, runs: [] });
		}
		const laneQueue = runsByLane.get(laneNumber);

		if (
			taskTerminalSuccessInBatch({
				events,
				task,
				taskFolder: taskFolderInWorktree,
			})
		) {
			continue;
		}

		if (taskAlreadyComplete({ taskFolder: taskFolderInWorktree, events, task })) {
			laneQueue.runs.push({
				taskId,
				run: () =>
					markTaskCompleteFromDisk({
						projectRoot,
						state,
						batchId,
						config,
						task,
						lane,
						taskBranch: lane.branch ?? laneTaskBranch(batchId, laneNumber),
						taskFolderInWorktree,
						laneCorrelationId,
					}),
			});
			continue;
		}

		if (!isTaskResumable(state, task)) {
			continue;
		}

		laneQueue.runs.push({
			taskId,
			run: () =>
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
		});
	}

	const laneExecutions = [...runsByLane.entries()].map(async ([laneNumber, { lane, runs }]) => {
		if (runs.length > 1) {
			appendJournalEvent(projectRoot, batchId, "lane.tasks_serialized", {
				laneNumber,
				laneId: lane.laneId,
				waveIndex,
				taskIds: runs.map((entry) => entry.taskId),
				correlationId: lane.correlationId ?? null,
			});
		}

		/** @type {object[]} */
		const laneResults = [];
		for (const { run } of runs) {
			const result = await run();
			laneResults.push(result);
			if (result.aborted) {
				batchAborted = true;
				return laneResults;
			}
		}
		return laneResults;
	});

	const waveResults = (await Promise.all(laneExecutions)).flat();
	return { ok: true, waveResults, batchAborted };
}
