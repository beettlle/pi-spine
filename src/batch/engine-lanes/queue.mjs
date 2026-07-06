// @ts-nocheck
/**
 * Lane queue and provisioning — build lane/task state from plan and handle
 * per-lane task prep (file scope) plus skip-when-done-on-disk queue behavior.
 */

import path from "node:path";
import { loadTaskPacket } from "../../tasks/packet/index.mjs";
import { appendJournalEvent } from "../journal.mjs";
import { recordTaskTerminalMetric } from "../metrics.mjs";
import { buildTaskLaneAssignments, countPlanTasks } from "../engine-scope.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../worktree.mjs";

/**
 * @param {object} params
 */
export function recordLaneTaskMetric({ projectRoot, batchId, task, config, taskFolder, lane }) {
	recordTaskTerminalMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
		laneNumber: lane?.laneNumber ?? task?.laneNumber,
	});
}

/**
 * @param {string} taskFolderPath
 */
export function loadTaskFileScopePaths(taskFolderPath) {
	try {
		const packet = loadTaskPacket(taskFolderPath);
		if (!packet.validation?.ok) {
			return {
				ok: false,
				error: packet.validation.errors.join("; "),
				errors: packet.validation.errors,
				promptPath: packet.promptPath,
			};
		}
		return { ok: true, fileScopePaths: packet.prompt?.fileScope ?? [] };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
			promptPath: path.join(taskFolderPath, "PROMPT.md"),
		};
	}
}

/**
 * @param {object} params
 */
export function recordPromptParseFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	scopeResult,
	config = {},
	taskFolderPath,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const parseError = scopeResult.error;

	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = "prompt_parse_failed";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "task.prompt_parse_failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		error: parseError,
		errors: scopeResult.errors,
		promptPath: scopeResult.promptPath,
	});
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		classification: "prompt_parse_failed",
		exitCode: 1,
		output: parseError,
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		lane,
		config,
		taskFolder: taskFolderPath,
	});

	return {
		ok: false,
		workerResult: {
			ok: false,
			classification: "prompt_parse_failed",
			output: parseError,
			exitCode: 1,
		},
	};
}

/**
 * @param {object} params
 */
export function buildTasksAndLanesFromPlan({ plan, discovered, projectRoot, batchId, maxLaneNumber }) {
	const assignments = buildTaskLaneAssignments(plan);
	const taskIds = countPlanTasks(plan);

	/** @type {Record<number, string[]>} */
	const laneTaskIds = {};
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		laneTaskIds[laneNumber] = [];
	}

	const tasks = taskIds.map((taskId) => {
		const entry = discovered.find((task) => task.taskId === taskId);
		const assignment = assignments.get(taskId) ?? { laneNumber: 1 };
		laneTaskIds[assignment.laneNumber].push(taskId);
		return {
			taskId,
			laneNumber: assignment.laneNumber,
			status: "pending",
			taskFolder: entry?.folderPath ?? null,
			startedAt: null,
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		};
	});

	const lanes = [];
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		lanes.push({
			laneNumber,
			laneId: `lane-${laneNumber}`,
			worktreePath: laneWorktreePath(projectRoot, batchId, laneNumber),
			branch: laneTaskBranch(batchId, laneNumber),
			taskIds: laneTaskIds[laneNumber] ?? [],
			lastHeartbeatAt: null,
		});
	}

	return { tasks, lanes, assignments };
}

/**
 * @param {object} params
 */
export async function skipTaskDoneOnDisk({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	taskFolderPath,
	laneCorrelationId,
	config = {},
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const endedAt = Date.now();
	const startedAt = task.startedAt ?? endedAt;

	recordTaskSucceeded(state, taskId, {
		exitReason: "skipped_done_on_disk",
		doneFileFound: true,
		endedAt,
		startedAt,
	});
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.skipped_done_on_disk",
		journalPayload: {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			taskFolder: taskFolderPath,
		},
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		lane,
		config,
		taskFolder: taskFolderPath,
	});
	return { ok: true, skipped: true };
}
