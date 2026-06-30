/**
 * Bounded worker stdout/stderr capture on terminal failure (FR-STALL-01).
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic, writeTextAtomic } from "../fs/atomic-write.mjs";
import { appendJournalEvent } from "./journal.mjs";

const DEFAULT_MAX_BYTES = 262_144;
const DEFAULT_LIVE_LOG_MAX_BYTES = 262_144;
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

	const liveMaxBytes = Number(lanes.workerLiveLogMaxBytes);

	return {
		maxBytes: Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES,
		tailLines: Number.isFinite(tailLines) && tailLines > 0 ? tailLines : DEFAULT_TAIL_LINES,
		retainOnSuccess: lanes.retainWorkerOutputOnSuccess === true,
		streamWorkerOutputLive: lanes.streamWorkerOutputLive === true,
		workerLiveLogMaxBytes:
			Number.isFinite(liveMaxBytes) && liveMaxBytes > 0
				? liveMaxBytes
				: DEFAULT_LIVE_LOG_MAX_BYTES,
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
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} taskId
 */
export function workerLiveLogPath(projectRoot, batchId, laneNumber, taskId) {
	return path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
		`worker-live-${taskId}.log`,
	);
}

/**
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} taskId
 */
export function workerLiveLogRef(batchId, laneNumber, taskId) {
	return path.join(
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
		`worker-live-${taskId}.log`,
	);
}

/**
 * Byte-cap live log content with the same truncation marker as terminal capture.
 *
 * @param {string} text
 * @param {number} maxBytes
 */
export function truncateLiveLogBytes(text, maxBytes) {
	if (!text) return "";

	const encoded = Buffer.from(text, "utf-8");
	if (encoded.byteLength <= maxBytes) {
		return text;
	}

	const markerBytes = Buffer.byteLength(TRUNCATION_MARKER, "utf-8");
	const budget = Math.max(0, maxBytes - markerBytes);
	let slice = encoded.subarray(encoded.byteLength - budget).toString("utf-8");
	const newline = slice.indexOf("\n");
	if (newline >= 0 && newline < slice.length - 1) {
		slice = slice.slice(newline + 1);
	}
	return `${TRUNCATION_MARKER}${slice}`;
}

/**
 * Append redacted worker output to the live log with a rolling byte cap.
 *
 * @param {object} params
 * @param {string} params.logPath
 * @param {string} params.rawChunk
 * @param {ReturnType<typeof resolveWorkerOutputConfig>} params.outputConfig
 */
export function appendWorkerLiveLogChunk({ logPath, rawChunk, outputConfig }) {
	if (!rawChunk) return;

	const redacted = redactWorkerOutput(String(rawChunk), outputConfig);
	if (!redacted) return;

	const prior = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf-8") : "";
	const combined = `${prior}${redacted}`;
	const capped = truncateLiveLogBytes(combined, outputConfig.workerLiveLogMaxBytes);
	if (!capped) return;

	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	writeTextAtomic(logPath, capped);
}

/**
 * Create an append-only live log writer when `lanes.streamWorkerOutputLive` is enabled.
 *
 * @param {object} params
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {object} [params.config]
 * @returns {{ append: (rawChunk: string) => void; logPath: string } | null}
 */
export function createWorkerLiveLogWriter({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	config = {},
}) {
	const outputConfig = resolveWorkerOutputConfig(config);
	if (!outputConfig.streamWorkerOutputLive) return null;
	if (!projectRoot || !batchId || laneNumber == null || !taskId) return null;

	const logPath = workerLiveLogPath(projectRoot, batchId, laneNumber, taskId);
	return {
		logPath,
		append(rawChunk) {
			appendWorkerLiveLogChunk({ logPath, rawChunk, outputConfig });
		},
	};
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
	writeTextAtomic(logPath, captured);

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

/**
 * Parse a `.DONE` marker body. Legacy empty/text markers remain valid (SP-321).
 *
 * @param {string} content
 */
export function parseWorkerDoneMarker(content) {
	const trimmed = String(content ?? "").trim();
	if (!trimmed) {
		return { valid: true, legacy: true, kind: "empty" };
	}

	if (trimmed.startsWith("{")) {
		try {
			const data = JSON.parse(trimmed);
			if (
				typeof data?.taskId === "string" &&
				data.taskId.length > 0 &&
				typeof data?.completedAt === "string" &&
				data.completedAt.length > 0
			) {
				return {
					valid: true,
					legacy: false,
					kind: "json",
					taskId: data.taskId,
					completedAt: data.completedAt,
				};
			}
			return { valid: false, legacy: false, kind: "json_partial", reason: "missing_fields" };
		} catch {
			return { valid: false, legacy: false, kind: "json_partial", reason: "parse_error" };
		}
	}

	return { valid: true, legacy: true, kind: "text" };
}

/**
 * @param {string} content
 */
export function isWorkerDoneMarkerValid(content) {
	return parseWorkerDoneMarker(content).valid;
}

/**
 * @param {string} donePath
 */
export function readWorkerDoneMarker(donePath) {
	if (!fs.existsSync(donePath)) {
		return { present: false, valid: false };
	}
	const parsed = parseWorkerDoneMarker(fs.readFileSync(donePath, "utf-8"));
	return { present: true, ...parsed };
}

/**
 * Atomically write a structured `.DONE` marker for engine validation.
 *
 * @param {string} donePath
 * @param {{ taskId: string }} params
 */
export function writeWorkerDoneMarker(donePath, { taskId }) {
	writeJsonAtomic(donePath, {
		taskId,
		completedAt: new Date().toISOString(),
	});
}

export {
	TRUNCATION_MARKER,
	DEFAULT_MAX_BYTES,
	DEFAULT_LIVE_LOG_MAX_BYTES,
	DEFAULT_TAIL_LINES,
};
