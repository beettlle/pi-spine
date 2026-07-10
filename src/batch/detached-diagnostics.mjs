// @ts-nocheck
/**
 * Detached batch failure diagnostics — log tails, worker paths, formatted output (SP-580).
 * Leaf module: no imports from detached-start, reconcile, or post-merge-limbo.
 */

import fs from "node:fs";
import path from "node:path";
import {
	DETACHED_ENGINE_LOG_REL,
	detachedEngineLogPath,
} from "./detached-spawn.mjs";
import { readLastTaskFailedEvent } from "./journal.mjs";

export const FAILURE_LOG_TAIL_LINES = 20;

const DETACHED_ENGINE_LOG_HEADER_RE = /^--- detached batch engine /;

/**
 * @param {string} filePath
 * @param {number} [lineCount]
 * @returns {string|null}
 */
function readLogTailLines(filePath, lineCount = FAILURE_LOG_TAIL_LINES) {
	if (!fs.existsSync(filePath)) return null;
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return null;
	return lines.slice(-lineCount).join("\n");
}

/**
 * Read tail of detached engine log, scoped to the current (last) batch session.
 * The append-only log contains headers like `--- detached batch engine <ISO> argv=... ---`
 * separating sessions. Without filtering, stale entries from previous batches are shown.
 *
 * @param {string} filePath
 * @param {number} [lineCount]
 * @returns {string|null}
 */
export function readCurrentBatchLogTail(filePath, lineCount = FAILURE_LOG_TAIL_LINES) {
	if (!fs.existsSync(filePath)) return null;
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return null;

	let lastHeaderIdx = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (DETACHED_ENGINE_LOG_HEADER_RE.test(lines[i])) {
			lastHeaderIdx = i;
			break;
		}
	}

	const sessionLines = lastHeaderIdx >= 0 ? lines.slice(lastHeaderIdx) : lines;
	if (sessionLines.length === 0) return null;
	return sessionLines.slice(-lineCount).join("\n");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string|null|undefined} taskId
 * @returns {string|null}
 */
function findWorkerOutputLogPath(projectRoot, batchId, taskId) {
	const lanesDir = path.join(projectRoot, ".spine", "runtime", batchId, "lanes");
	if (!fs.existsSync(lanesDir)) return null;

	/** @type {string|null} */
	let newestPath = null;
	/** @type {number} */
	let newestMtime = 0;

	for (const laneDir of fs.readdirSync(lanesDir)) {
		if (!laneDir.startsWith("lane-")) continue;
		const lanePath = path.join(lanesDir, laneDir);
		for (const name of fs.readdirSync(lanePath)) {
			if (!name.startsWith("worker-output-") || !name.endsWith(".log")) continue;
			if (taskId && name !== `worker-output-${taskId}.log`) continue;
			const candidate = path.join(lanePath, name);
			const mtime = fs.statSync(candidate).mtimeMs;
			if (mtime >= newestMtime) {
				newestMtime = mtime;
				newestPath = candidate;
			}
		}
	}

	return newestPath;
}

/**
 * @param {object} event
 */
function summarizeTaskFailedEvent(event) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	/** @type {string[]} */
	const parts = [];
	if (event.taskId) parts.push(`task ${event.taskId}`);
	if (payload.classification) parts.push(String(payload.classification));
	if (payload.error) parts.push(String(payload.error).slice(0, 120));
	if (payload.output) parts.push(String(payload.output).slice(0, 120));
	if (payload.reason) parts.push(String(payload.reason));
	return parts.join(" — ") || JSON.stringify(payload).slice(0, 160);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null|undefined} [params.batchId]
 * @param {string|null|undefined} [params.taskId]
 * @param {string|null|undefined} [params.logPath]
 */
export function collectDetachedFailureDiagnostics({ projectRoot, batchId, taskId, logPath }) {
	/** @type {Record<string, unknown>} */
	const diagnostics = {};

	if (batchId) {
		const failedEvent = readLastTaskFailedEvent(projectRoot, batchId);
		if (failedEvent) {
			diagnostics.taskFailedEvent = failedEvent;
			diagnostics.taskFailedSummary = summarizeTaskFailedEvent(failedEvent);
		}
	}

	if (batchId) {
		const workerLogPath = findWorkerOutputLogPath(projectRoot, batchId, taskId ?? null);
		if (workerLogPath) {
			const tail = readLogTailLines(workerLogPath);
			if (tail) {
				diagnostics.workerLogPath = path.relative(projectRoot, workerLogPath);
				diagnostics.workerLogTail = tail;
			}
		}
	}

	const engineLogPath = logPath
		? path.isAbsolute(logPath)
			? logPath
			: path.join(projectRoot, logPath)
		: detachedEngineLogPath(projectRoot);
	const engineTail = readCurrentBatchLogTail(engineLogPath);
	if (engineTail) {
		diagnostics.engineLogPath = path.isAbsolute(logPath ?? "")
			? logPath
			: logPath ?? DETACHED_ENGINE_LOG_REL;
		diagnostics.engineLogTail = engineTail;
	}

	return diagnostics;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null|undefined} [params.batchId]
 * @param {string|null|undefined} [params.taskId]
 * @param {string|null|undefined} [params.logPath]
 */
export function attachDetachedFailureDiagnostics(payload, { projectRoot, batchId, taskId, logPath }) {
	const diagnostics = collectDetachedFailureDiagnostics({ projectRoot, batchId, taskId, logPath });
	if (diagnostics.taskFailedSummary) payload.taskFailedSummary = diagnostics.taskFailedSummary;
	if (diagnostics.workerLogTail) {
		payload.workerLogPath = diagnostics.workerLogPath;
		payload.workerLogTail = diagnostics.workerLogTail;
	}
	if (diagnostics.engineLogTail) {
		payload.engineLogPath = diagnostics.engineLogPath;
		payload.engineLogTail = diagnostics.engineLogTail;
	}
	return payload;
}

/**
 * @param {object} result
 * @param {boolean} [json]
 */
export function formatDetachedEngineOutput(result, json = false) {
	if (json) {
		return `${JSON.stringify(result, null, 2)}\n`;
	}

	const operation = result.operation ?? "start";
	const operationLabel = operation === "resume" ? "resume" : "start";

	if (!result.ok) {
		const lines = [
			"",
			`Detached batch ${operationLabel} failed`,
			"",
			result.output ?? result.error ?? "Unknown error",
		];
		if (result.taskFailedSummary) {
			lines.push("", "  Last task.failed:", `    ${result.taskFailedSummary}`);
		}
		if (result.workerLogTail) {
			lines.push(
				"",
				`  Worker log tail${result.workerLogPath ? ` (${result.workerLogPath})` : ""}:`,
				...result.workerLogTail.split("\n").map((line) => `    ${line}`),
			);
		}
		if (result.engineLogTail) {
			lines.push(
				"",
				`  Detached engine log tail${result.engineLogPath ? ` (${result.engineLogPath})` : ""}:`,
				...result.engineLogTail.split("\n").map((line) => `    ${line}`),
			);
		}
		if (result.logPath) {
			lines.push("", `  Log: ${result.logPath}`);
		}
		if (result.suggestedCommand) {
			lines.push("", `  → ${result.suggestedCommand}`);
		}
		lines.push("", "  Run with --attached for foreground errors.", "");
		return lines.join("\n");
	}

	/** @type {string} */
	let headline;
	if (result.status === "resume_completed" || result.status === "start_completed") {
		headline =
			operationLabel === "resume"
				? "Batch resume completed."
				: "Batch start completed.";
	} else if (result.status === "engine_started") {
		headline =
			operationLabel === "resume"
				? "Batch engine resuming in the background (engine started; resume not yet confirmed)."
				: "Batch engine starting in the background (engine started; batch not yet confirmed).";
	} else {
		headline = `Batch engine ${operationLabel === "resume" ? "resuming" : "starting"} in the background.`;
	}

	const lines = ["", headline, ""];
	if (result.status) lines.push(`  Status: ${result.status}`);
	if (result.scope) lines.push(`  Scope: ${result.scope}`);
	if (result.batchId) lines.push(`  Batch: ${result.batchId}`);
	if (result.taskId) lines.push(`  Task: ${result.taskId}`);
	if (result.phase) lines.push(`  Phase: ${result.phase}`);
	if (result.enginePid) lines.push(`  Engine PID: ${result.enginePid}`);
	if (result.logPath) lines.push(`  Log: ${result.logPath}`);
	lines.push("", `  → ${result.suggestedCommand ?? "spine status --diagnose"}`, "");
	return lines.join("\n");
}

/** @deprecated use formatDetachedEngineOutput */
export function formatDetachedBatchStartOutput(result, json = false) {
	return formatDetachedEngineOutput(result, json);
}
