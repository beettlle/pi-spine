// @ts-nocheck
/** Diagnosis derivation (SP-596/SP-606 / #192). */

import fs from "node:fs";
import {
	inferLaunchFailureFromWorkerOutputTail,
	inferLaunchFailureKind,
} from "./diagnosis.mjs";
import { inferWorkerDoneMissingFailure } from "./diagnosis-worker-done-missing.mjs";
import { inferStubExitReasonForTask } from "./diagnosis-stub.mjs";
import { workerOutputLogPath, workerOutputLogRef } from "./worker-output.mjs";
import { journalEventsSinceResume } from "./orphan-detect.mjs";
import { isPostMergeLimbo } from "./limbo-detect.mjs";
import { isProcessAlive } from "../process/liveness.mjs";
import { readBatchEnginePid } from "./state.mjs";
import {
	LIMBO_PHASES,
	RUNNING_PHASES,
} from "./reconcile-light-cache.mjs";

/**
 * @param {unknown} rawTasks
 * @param {string|null} failedTaskId
 * @returns {string|null}
 */
function resolveFailedExitReason(rawTasks, failedTaskId) {
	if (!failedTaskId || !Array.isArray(rawTasks)) return null;
	const match = rawTasks.find((entry) => {
		if (!entry || typeof entry !== "object") return false;
		return String(entry.taskId ?? entry.id ?? "") === failedTaskId;
	});
	if (!match || typeof match !== "object") return null;
	const exitReason = /** @type {{ exitReason?: unknown }} */ (match).exitReason;
	return typeof exitReason === "string" && exitReason ? exitReason : null;
}

/**
 * @param {string|null} failedTaskId
 * @param {object} signals
 * @returns {string|null}
 */
function resolvePrimaryFailureExitReason(failedTaskId, signals) {
	const fromTask = resolveFailedExitReason(signals.raw?.tasks, failedTaskId);
	if (fromTask) return fromTask;
	if (!failedTaskId) return null;
	if (Array.isArray(signals.segments)) {
		const segment = signals.segments.find((entry) => entry?.taskId === failedTaskId);
		const classification = segment?.classification;
		if (
			typeof classification === "string" &&
			classification &&
			classification !== "terminal-failure"
		) {
			return classification;
		}
	}
	if (Array.isArray(signals.journalEvents)) {
		for (let index = signals.journalEvents.length - 1; index >= 0; index -= 1) {
			const event = signals.journalEvents[index];
			if (event.type !== "task.failed") continue;
			const eventTaskId = event.taskId ?? event.payload?.taskId;
			if (eventTaskId !== failedTaskId) continue;
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			const reason = payload.exitReason ?? payload.classification;
			if (typeof reason === "string" && reason) return reason;
		}
	}
	return null;
}

/**
 * @param {string|null} failedTaskId
 * @param {string|null} exitReason
 * @param {object} signals
 * @returns {{ exitReason: string|null, launchFailureKind: string|null }}
 */
function deriveFailureContext(failedTaskId, exitReason, signals) {
	let resolvedExitReason =
		exitReason ?? resolvePrimaryFailureExitReason(failedTaskId, signals);
	if (failedTaskId && signals.tasksRoot) {
		const taskFolder =
			signals.tasks?.find((entry) => entry.taskId === failedTaskId)?.taskFolder ?? null;
		const stubReason = inferStubExitReasonForTask(signals.tasksRoot, failedTaskId, taskFolder);
		if (stubReason) {
			resolvedExitReason = stubReason;
		}
	}
	const launchFailureKind = inferLaunchFailureKind({
		exitReason: resolvedExitReason,
		journalEvents: signals.journalEvents,
		failedTaskId,
	});
	return { exitReason: resolvedExitReason, launchFailureKind };
}

const WORKER_OUTPUT_TAIL_LINES = 20;

/**
 * @param {string} filePath
 * @param {number} [lineCount]
 * @returns {string|null}
 */
function readWorkerOutputLogTail(filePath, lineCount = WORKER_OUTPUT_TAIL_LINES) {
	if (!fs.existsSync(filePath)) return null;
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return null;
	return lines.slice(-lineCount).join("\n");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string|null} failedTaskId
 * @param {Array<{ taskId: string, laneNumber?: number|null }>} tasks
 * @param {string|null} launchFailureKind
 * @returns {string|null}
 */
export function enrichLaunchFailureFromWorkerOutput(projectRoot, batchId, failedTaskId, tasks, launchFailureKind) {
	if (launchFailureKind || !failedTaskId || !batchId) return launchFailureKind;
	const task = tasks.find((entry) => entry.taskId === failedTaskId);
	if (!task || task.laneNumber == null) return launchFailureKind;
	const logPath = workerOutputLogPath(projectRoot, batchId, task.laneNumber, failedTaskId);
	const tail = readWorkerOutputLogTail(logPath);
	return inferLaunchFailureFromWorkerOutputTail(tail) ?? launchFailureKind;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string|null} failedTaskId
 * @param {Array<{ taskId: string, laneNumber?: number|null }>} tasks
 * @param {object|null} doneMissingHint
 * @returns {{ workerOutputLogRef: string|null, workerOutputLogPath: string|null, workerOutputTail: string|null, workerOutputSnippet: string|null, changedFileCount: number|null }}
 */
export function enrichWorkerDoneMissingContext(
	projectRoot,
	batchId,
	failedTaskId,
	tasks,
	doneMissingHint,
) {
	const task = tasks.find((entry) => entry.taskId === failedTaskId);
	const laneNumber = task?.laneNumber;
	const logRef =
		doneMissingHint?.workerOutputLogRef ??
		(failedTaskId && laneNumber != null
			? workerOutputLogRef(batchId, laneNumber, failedTaskId)
			: null);
	const logPath =
		doneMissingHint?.workerOutputLogPath ??
		(failedTaskId && laneNumber != null
			? workerOutputLogPath(projectRoot, batchId, laneNumber, failedTaskId)
			: null);
	const tailFromDisk = logPath ? readWorkerOutputLogTail(logPath) : null;
	const outputText = [doneMissingHint?.output, tailFromDisk].filter(Boolean).join("\n");
	const snippet = outputText
		? outputText
				.split("\n")
				.filter(Boolean)
				.slice(-3)
				.join(" | ")
		: null;

	return {
		workerOutputLogRef: logRef,
		workerOutputLogPath: logPath,
		workerOutputTail: tailFromDisk,
		workerOutputSnippet: snippet,
		changedFileCount:
			doneMissingHint?.changedFileCount != null ? doneMissingHint.changedFileCount : null,
	};
}

/**
 * @param {Array<{ taskId: string, classification: string, laneNumber?: number|null }>} tasks
 * @param {string|null} failedTaskId
 * @returns {boolean}
 */
export function hasGhostRunningCluster(tasks, failedTaskId) {
	if (!failedTaskId) return false;
	const task = tasks.find((entry) => entry.taskId === failedTaskId);
	if (!task || task.laneNumber == null) return false;
	const laneNumber = Number(task.laneNumber);
	return (
		tasks.filter(
			(entry) =>
				entry.classification === "running" && Number(entry.laneNumber) === laneNumber,
		).length > 1
	);
}

/**
 * @param {object[]} journalEvents
 * @param {string|null} failedTaskId
 * @returns {string[]}
 */
export function extractGitignoredPathsFromJournal(journalEvents, failedTaskId) {
	if (!Array.isArray(journalEvents)) return [];
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event.type !== "task.failed") continue;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		if (failedTaskId && eventTaskId && eventTaskId !== failedTaskId) continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (Array.isArray(payload.gitignoredPaths)) {
			return payload.gitignoredPaths.filter((entry) => typeof entry === "string");
		}
	}
	return [];
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {string} batchId
 * @param {string} taskId
 * @returns {string|null}
 */
export function laneTaskBranchForDiagnosis(raw, batchId, taskId) {
	const tasks = raw?.tasks;
	if (!Array.isArray(tasks)) return null;
	const task = tasks.find((entry) => entry?.taskId === taskId);
	if (!task || task.laneNumber == null) return null;
	return `task/spine-lane-${task.laneNumber}-${batchId}`;
}

/**
 * @param {string} diagnosis
 * @param {string|null} failedTaskId
 * @param {object} signals
 * @param {string|null} [exitReason]
 */
function withFailureContext(diagnosis, failedTaskId, signals, exitReason = null) {
	const context = deriveFailureContext(failedTaskId, exitReason, signals);
	return {
		diagnosis,
		failedTaskId,
		exitReason: context.exitReason,
		launchFailureKind: context.launchFailureKind,
	};
}

/**
 * @param {object[]} journalEvents
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {string|null} taskId
 */
function journalIndicatesResumeRulesStall(journalEvents, raw, taskId) {
	const scoped = journalEventsSinceResume(journalEvents, raw);
	const hasRulesSelected = scoped.some((event) => {
		if (event.type !== "worker.rules_selected") return false;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		return !taskId || !eventTaskId || eventTaskId === taskId;
	});
	const hasBatchResumed = scoped.some((event) => event.type === "batch.resumed");
	return hasRulesSelected && hasBatchResumed;
}

/**
 * @param {object} signals
 */
function findNeedsReplanTask(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return (
		tasks.find(
			(task) =>
				task?.exitReason === "needs_replan" &&
				(task.status === "failed" || task.classification === "terminal-failure"),
		) ?? null
	);
}

/**
 * @param {object} signals
 */
function hasNeedsReplanBlocker(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return tasks.some((task) => task?.exitReason === "needs_replan");
}

/**
 * @param {object} signals
 */
export function deriveDiagnosis(signals) {
	const {
		phase,
		endedAt,
		failedTasks,
		allTasksTerminalSuccess,
		hasRunningTasks,
		hasPendingTasks,
		hasFailedTasks,
		hasSegmentDrift,
		failedTaskId,
		mergeResultsEmpty,
		git,
		orphanRunning,
	} = signals;

	if (orphanRunning) {
		if (orphanRunning.kind === "lane" && orphanRunning.taskId) {
			const enginePid = readBatchEnginePid(signals.raw);
			const engineDead = enginePid == null || !isProcessAlive(enginePid);
			const resumeRulesStall = journalIndicatesResumeRulesStall(
				signals.journalEvents ?? [],
				signals.raw,
				orphanRunning.taskId,
			);
			if (engineDead && resumeRulesStall) {
				return withFailureContext("engine_orphaned", orphanRunning.taskId, signals);
			}
			return withFailureContext("worker_orphaned", orphanRunning.taskId, signals);
		}
		return withFailureContext("engine_orphaned", orphanRunning.taskId ?? null, signals);
	}

	if (signals.stateDrift?.drifted) {
		const driftTask = signals.stateDrift.entries.find((entry) => entry.taskId !== "*");
		return withFailureContext("state_drift", driftTask?.taskId ?? null, signals);
	}

	if (
		!hasRunningTasks &&
		hasPendingTasks &&
		Array.isArray(signals.tasks) &&
		signals.tasks.some(
			(task) =>
				task?.doneInLane === true &&
				(task.status === "pending" || task.status === "running" || task.classification === "pending" || task.classification === "running"),
		)
	) {
		const driftTask = signals.tasks.find((task) => task?.doneInLane);
		return withFailureContext("needs_retry", driftTask?.taskId ?? null, signals);
	}

	if (git?.gitInspectionError) {
		return withFailureContext("git_unavailable", null, signals);
	}

	if (phase === "aborted") {
		return withFailureContext("aborted", null, signals);
	}
	if (phase === "completed" && endedAt != null) {
		if (git.orchBranchExists && !git.orchMergedToBase) {
			return withFailureContext("needs_integrate", null, signals);
		}
		return withFailureContext("completed", null, signals);
	}

	const limboSignals =
		allTasksTerminalSuccess &&
		failedTasks === 0 &&
		LIMBO_PHASES.has(phase) &&
		endedAt == null &&
		mergeResultsEmpty;

	if (limboSignals && git.orchMergedToBase) {
		return withFailureContext("completed_manual", null, signals);
	}

	if (limboSignals) {
		return withFailureContext("limbo_stale", null, signals);
	}

	if (hasFailedTasks || hasSegmentDrift) {
		const replanTask = findNeedsReplanTask(signals);
		if (replanTask) {
			return withFailureContext(
				"needs_replan",
				replanTask.taskId ?? failedTaskId,
				signals,
				"needs_replan",
			);
		}
		const doneMissing = inferWorkerDoneMissingFailure({
			journalEvents: signals.journalEvents,
			failedTaskId,
		});
		if (doneMissing) {
			return withFailureContext("worker_done_missing", failedTaskId, signals);
		}
		return withFailureContext("needs_retry", failedTaskId, signals);
	}

	if (hasNeedsReplanBlocker(signals)) {
		const replanTask = findNeedsReplanTask(signals);
		return withFailureContext(
			"needs_replan",
			replanTask?.taskId ?? failedTaskId,
			signals,
			"needs_replan",
		);
	}

	const postMergeLimbo = isPostMergeLimbo(signals.raw ?? {}, git);
	signals.postMergeLimbo = postMergeLimbo;

	if (postMergeLimbo) {
		return withFailureContext("needs_integrate", null, signals);
	}

	if (phase === "merge_blocked") {
		return withFailureContext("failed", null, signals);
	}

	if (
		phase === "merging" &&
		endedAt != null &&
		Array.isArray(signals.raw?.mergeResults) &&
		signals.raw.mergeResults.some((entry) => String(entry?.status ?? "").toLowerCase() === "failed")
	) {
		return withFailureContext("failed", null, signals);
	}

	if (phase === "merging" || (allTasksTerminalSuccess && mergeResultsEmpty && git.orchBranchExists && !git.orchMergedToBase)) {
		if (allTasksTerminalSuccess && git.orchBranchExists && !git.orchMergedToBase && !mergeResultsEmpty) {
			return withFailureContext("needs_integrate", null, signals);
		}
		return withFailureContext("needs_merge", null, signals);
	}

	if (allTasksTerminalSuccess && git.orchBranchExists && !git.orchMergedToBase && mergeResultsEmpty) {
		return withFailureContext("needs_integrate", null, signals);
	}

	if (
		phase === "failed" &&
		!hasFailedTasks &&
		!hasSegmentDrift &&
		hasPendingTasks
	) {
		return withFailureContext("needs_retry", null, signals);
	}

	if (
		phase === "failed" &&
		!hasFailedTasks &&
		!hasSegmentDrift &&
		allTasksTerminalSuccess &&
		mergeResultsEmpty
	) {
		return withFailureContext("needs_merge", null, signals);
	}

	if (phase === "failed" || (failedTasks > 0 && !hasPendingTasks && !hasRunningTasks)) {
		return withFailureContext("failed", failedTaskId, signals);
	}

	if (phase === "paused") {
		return withFailureContext("paused", null, signals);
	}

	if (RUNNING_PHASES.has(phase) || hasRunningTasks || hasPendingTasks) {
		return withFailureContext("running", null, signals);
	}

	return withFailureContext("paused", null, signals);
}
