/**
 * Diagnosis enrichment helpers for reconcile.
 * Extracted from reconcile-diagnosis.mjs to stay under the Phase 23 500 LOC cap.
 */

import fs from "node:fs";
import { inferLaunchFailureFromWorkerOutputTail } from "./diagnosis.mjs";
import { workerOutputLogPath, workerOutputLogRef } from "./worker-output.mjs";

const WORKER_OUTPUT_TAIL_LINES = 20;

/**
 * @typedef {{
 *   taskId: string,
 *   laneNumber?: number|null,
 *   classification?: string,
 * }} DiagnosisTaskRow
 */

/**
 * @typedef {{
 *   workerOutputLogRef?: string|null,
 *   workerOutputLogPath?: string|null,
 *   output?: string|null,
 *   changedFileCount?: number|null,
 * }} DoneMissingHint
 */

/**
 * @typedef {{
 *   type?: string,
 *   taskId?: string,
 *   payload?: {
 *     taskId?: string,
 *     gitignoredPaths?: unknown,
 *   },
 * }} JournalEventLike
 */

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
 * @param {DiagnosisTaskRow[]} tasks
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
 * @param {DiagnosisTaskRow[]} tasks
 * @param {DoneMissingHint|null|undefined} doneMissingHint
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
 * @param {DiagnosisTaskRow[]} tasks
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
 * @param {JournalEventLike[]} journalEvents
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
	const task = /** @type {DiagnosisTaskRow|undefined} */ (
		tasks.find((entry) => {
			if (!entry || typeof entry !== "object") return false;
			return /** @type {{ taskId?: unknown }} */ (entry).taskId === taskId;
		})
	);
	if (!task || task.laneNumber == null) return null;
	return `task/spine-lane-${task.laneNumber}-${batchId}`;
}
