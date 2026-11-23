/**
 * Lane queue and provisioning — build lane/task state from plan and handle
 * per-lane task prep (file scope) plus skip-when-done-on-disk queue behavior.
 */

import path from "node:path";
import fs from "node:fs";
import { loadTaskPacket } from "../../tasks/packet/index.mjs";
import { appendJournalEvent } from "../journal.mjs";
import { recordTaskTerminalMetric, resolveTaskMetricOutcome } from "../metrics.mjs";
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
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Record<string, any>} params.task
 * @param {Record<string, any>} [params.config]
 * @param {string} [params.taskFolder]
 * @param {{ laneNumber?: number }} [params.lane]
 */
export function recordLaneTaskMetric({ projectRoot, batchId, task, config, taskFolder, lane }) {
	// SP-879 (#338): attach provider-reported worker usage from the sidecar the
	// runner wrote after the pi JSON run. Skipped tasks never ran a worker, so
	// they must not inherit a stale committed sidecar from an earlier batch.
	if (resolveTaskMetricOutcome(task) !== "skipped") {
		attachTaskUsageFromSidecar({ taskFolder, task });
	}
	const metricParams = {
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
		laneNumber: lane?.laneNumber ?? task?.laneNumber,
	};
	recordTaskTerminalMetric(metricParams);
}

/** Sidecar filename the worker runner writes after a pi JSON run (bin/spine-worker-runner.mjs). Keep both definitions in sync. */
const WORKER_USAGE_SIDECAR_FILENAME = "worker-usage.json";
const WORKER_USAGE_KEYS = ["tokensIn", "tokensOut", "estimatedUsd"];

/**
 * Copy finite worker usage counters from the runner's `worker-usage.json`
 * sidecar onto the task object before the metric record is built
 * (`buildTaskMetricRecord` copies finite `task.tokens*` / `task.estimatedUsd`).
 *
 * Lenient by design: a missing, malformed, or partially valid sidecar never
 * throws and never invents values — only present, finite, non-negative
 * numbers are copied, and existing finite task fields win.
 *
 * @param {object} params
 * @param {string} [params.taskFolder]
 * @param {Record<string, any>} params.task
 * @returns {boolean} true when at least one usage field was attached.
 */
export function attachTaskUsageFromSidecar({ taskFolder, task }) {
	if (!taskFolder || !task) return false;
	const sidecarPath = path.join(taskFolder, WORKER_USAGE_SIDECAR_FILENAME);
	let raw;
	try {
		if (!fs.existsSync(sidecarPath)) return false;
		raw = fs.readFileSync(sidecarPath, "utf-8");
	} catch {
		return false;
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return false;
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return false;
	// SP-884 (#377): the sidecar is a process-boundary input (a child runner
	// writes it). Accept legacy sidecars that omit producer identity, but reject
	// files stamped as a different record type or an unknown future schema so a
	// lookalike `worker-usage.json` cannot inject tokens into metric rows.
	if (parsed.recordType !== undefined && parsed.recordType !== "worker-usage") return false;
	if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== 1) return false;
	let attached = false;
	for (const key of WORKER_USAGE_KEYS) {
		const value = parsed[key];
		if (typeof value === "number" && Number.isFinite(value) && value >= 0 && !Number.isFinite(task[key])) {
			task[key] = value;
			attached = true;
		}
	}
	return attached;
}

/**
 * @param {string} taskFolderPath
 * @returns {{ ok: true, fileScopePaths: string[] } | { ok: false, error: string, errors?: string[], promptPath: string }}
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
 * @param {string} params.projectRoot
 * @param {Record<string, any>} params.state
 * @param {string} params.batchId
 * @param {Record<string, any>} params.task
 * @param {{ laneNumber?: number, laneId?: string }} params.lane
 * @param {string} [params.laneCorrelationId]
 * @param {{ ok: false, error: string, errors?: string[], promptPath?: string }} params.scopeResult
 * @param {Record<string, any>} [params.config]
 * @param {string} [params.taskFolderPath]
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
 * @param {any} params.plan
 * @param {Array<{ taskId: string, folderPath?: string }>} params.discovered
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.maxLaneNumber
 */
export function buildTasksAndLanesFromPlan({ plan, discovered, projectRoot, batchId, maxLaneNumber }) {
	const assignments = buildTaskLaneAssignments(plan);
	/** @type {string[]} */
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
 * @param {string} params.projectRoot
 * @param {Record<string, any>} params.state
 * @param {string} params.batchId
 * @param {Record<string, any>} params.task
 * @param {{ laneNumber?: number, laneId?: string }} params.lane
 * @param {string} params.taskFolderPath
 * @param {string} [params.laneCorrelationId]
 * @param {Record<string, any>} [params.config]
 */
export function skipTaskDoneOnDisk({
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
