/**
 * Bounded worker stdout/stderr capture on terminal failure (FR-STALL-01).
 */

import fs from "node:fs";
import path from "node:path";
import { appendJournalEvent } from "./journal.mjs";

const DEFAULT_MAX_BYTES = 262_144;
const DEFAULT_TAIL_LINES = 200;
const TRUNCATION_MARKER = "\n...[worker output truncated]...\n";

const BUILTIN_REDACT_PATTERNS = [
	/DATABASE_URL=\S+/gi,
	/(?:postgres|mysql|mongodb)(?:\+srv)?:\/\/[^\s]+/gi,
	/(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi,
	/sk-[a-zA-Z0-9]{20,}/g,
	/ghp_[a-zA-Z0-9]{20,}/g,
];

/**
 * @param {object} [config]
 */
export function resolveWorkerOutputConfig(config = {}) {
	const lanes = config.lanes ?? {};
	const maxBytes = Number(lanes.workerOutputMaxBytes);
	const tailLines = Number(lanes.workerOutputTailLines);
	/** @type {RegExp[]} */
	const denyPatterns = [];
	if (Array.isArray(lanes.workerOutputDenyPatterns)) {
		for (const pattern of lanes.workerOutputDenyPatterns) {
			if (typeof pattern !== "string" || !pattern.trim()) continue;
			try {
				denyPatterns.push(new RegExp(pattern, "gi"));
			} catch {
				// skip invalid config patterns
			}
		}
	}

	return {
		maxBytes: Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES,
		tailLines: Number.isFinite(tailLines) && tailLines > 0 ? tailLines : DEFAULT_TAIL_LINES,
		retainOnSuccess: lanes.retainWorkerOutputOnSuccess === true,
		denyPatterns,
	};
}

/**
 * @param {string} text
 * @param {ReturnType<typeof resolveWorkerOutputConfig>} outputConfig
 */
export function redactWorkerOutput(text, outputConfig) {
	if (!text) return "";
	let out = text;
	for (const pattern of BUILTIN_REDACT_PATTERNS) {
		out = out.replace(pattern, "[REDACTED]");
	}
	for (const pattern of outputConfig.denyPatterns) {
		out = out.replace(pattern, "[REDACTED]");
	}
	return out;
}

/**
 * @param {string} raw
 * @param {ReturnType<typeof resolveWorkerOutputConfig>} outputConfig
 */
export function captureWorkerOutputTail(raw, outputConfig) {
	if (!raw) return "";

	const lines = raw.split(/\r?\n/);
	const tail =
		lines.length > outputConfig.tailLines
			? lines.slice(-outputConfig.tailLines).join("\n")
			: raw;

	const encoded = Buffer.from(tail, "utf-8");
	if (encoded.byteLength <= outputConfig.maxBytes) {
		return tail;
	}

	const markerBytes = Buffer.byteLength(TRUNCATION_MARKER, "utf-8");
	const budget = Math.max(0, outputConfig.maxBytes - markerBytes);
	let slice = encoded.subarray(encoded.byteLength - budget).toString("utf-8");
	const newline = slice.indexOf("\n");
	if (newline >= 0 && newline < slice.length - 1) {
		slice = slice.slice(newline + 1);
	}
	return `${TRUNCATION_MARKER}${slice}`;
}

/**
 * @param {string} classification
 * @param {boolean} ok
 * @param {ReturnType<typeof resolveWorkerOutputConfig>} outputConfig
 */
export function shouldCaptureWorkerOutput(classification, ok, outputConfig) {
	if (ok) return outputConfig.retainOnSuccess;
	return classification === "stall_timeout" || classification === "failed" || classification === "aborted";
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} taskId
 */
export function workerOutputLogPath(projectRoot, batchId, laneNumber, taskId) {
	return path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
		`worker-output-${taskId}.log`,
	);
}

/**
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} taskId
 */
export function workerOutputLogRef(batchId, laneNumber, taskId) {
	return path.join(
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
		`worker-output-${taskId}.log`,
	);
}

/**
 * @param {object} params
 */
export function persistWorkerOutputLog({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	rawOutput,
	config = {},
}) {
	const outputConfig = resolveWorkerOutputConfig(config);
	const captured = captureWorkerOutputTail(redactWorkerOutput(rawOutput, outputConfig), outputConfig);
	if (!captured.trim()) return null;

	const logPath = workerOutputLogPath(projectRoot, batchId, laneNumber, taskId);
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	fs.writeFileSync(logPath, captured, "utf-8");

	return {
		logPath,
		logRef: workerOutputLogRef(batchId, laneNumber, taskId),
		output: captured,
	};
}

/**
 * @param {object} params
 */
export function recordStallKilled({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	correlationId,
	exitCode,
	logPath,
	logRef,
	stallDeadline,
	signals,
}) {
	appendJournalEvent(projectRoot, batchId, "lane.stall_killed", {
		laneNumber,
		taskId,
		correlationId,
		exitCode,
		logPath: logRef ?? logPath,
		stallDeadline,
		progressSignals: signals,
		statusMtimeMs: signals?.statusMtimeMs,
		lastCommitAtMs: signals?.lastCommitAtMs,
		fileScopeMtimeMs: signals?.fileScopeMtimeMs,
		stepCompletedAtMs: signals?.stepCompletedAtMs,
	});
}

/**
 * @param {object} params
 */
export function finalizeWorkerOutput({
	rawOutput = "",
	classification,
	ok,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	correlationId,
	exitCode,
	stallDeadline,
	signals,
	config = {},
}) {
	const outputConfig = resolveWorkerOutputConfig(config);
	if (!shouldCaptureWorkerOutput(classification, ok, outputConfig)) {
		return { output: rawOutput, logPath: null, logRef: null };
	}

	const redacted = redactWorkerOutput(rawOutput, outputConfig);
	const output = captureWorkerOutputTail(redacted, outputConfig) || redacted;

	if (!projectRoot || !batchId || laneNumber == null || !taskId) {
		return { output, logPath: null, logRef: null };
	}

	const persisted = persistWorkerOutputLog({
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		rawOutput,
		config,
	});

	if (classification === "stall_timeout" && persisted) {
		recordStallKilled({
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			correlationId,
			exitCode: exitCode ?? 124,
			logPath: persisted.logPath,
			logRef: persisted.logRef,
			stallDeadline,
			signals,
		});
	}

	return {
		output: persisted?.output ?? output,
		logPath: persisted?.logPath ?? null,
		logRef: persisted?.logRef ?? null,
	};
}

export { TRUNCATION_MARKER, DEFAULT_MAX_BYTES, DEFAULT_TAIL_LINES };
