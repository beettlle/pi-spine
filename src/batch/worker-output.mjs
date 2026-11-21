// @ts-nocheck
/**
 * Bounded worker stdout/stderr capture on terminal failure (FR-STALL-01).
 */

import fs from "node:fs";
import path from "node:path";
import { writeTextAtomic } from "../fs/atomic-write.mjs";
import { redactTextSecrets } from "../util/secret-redact.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	looksLikePiJsonNdjson,
	summarizePiJsonFailureOutput,
} from "./worker-output-json-summary.mjs";

export {
	looksLikePiJsonNdjson,
	summarizePiJsonFailureOutput,
} from "./worker-output-json-summary.mjs";

export {
	BACKGROUND_VERIFICATION_HINT,
	detectBackgroundedVerification,
	isWorkerDoneMarkerValid,
	parseWorkerDoneMarker,
	readWorkerDoneMarker,
	writeWorkerDoneMarker,
} from "./worker-done-marker.mjs";

const DEFAULT_MAX_BYTES = 262_144;
const DEFAULT_LIVE_LOG_MAX_BYTES = 262_144;
const DEFAULT_TAIL_LINES = 200;
const TRUNCATION_MARKER = "\n...[worker output truncated]...\n";

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
 * Redact value-shaped secrets in worker output via the shared policy
 * (SP-716); caller-configured deny patterns run after the builtin set.
 *
 * @param {string} text
 * @param {ReturnType<typeof resolveWorkerOutputConfig>} outputConfig
 */
export function redactWorkerOutput(text, outputConfig) {
	if (!text) return "";
	return /** @type {string} */ (redactTextSecrets(String(text), outputConfig.denyPatterns));
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
 * Append redacted worker output to the live log (SP-787 / #306). The hot path
 * is a pure append — the file is never re-read per chunk. Only when it has
 * grown past twice `workerLiveLogMaxBytes` is it truncated back to the cap.
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

	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	fs.appendFileSync(logPath, redacted);

	const size = fs.statSync(logPath, { throwIfNoEntry: false })?.size ?? 0;
	if (size <= outputConfig.workerLiveLogMaxBytes * 2) return;

	const capped = truncateLiveLogBytes(fs.readFileSync(logPath, "utf-8"), outputConfig.workerLiveLogMaxBytes);
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
	const tailed = captureWorkerOutputTail(redacted, outputConfig) || redacted;

	if (!projectRoot || !batchId || laneNumber == null || !taskId) {
		const output =
			!ok && looksLikePiJsonNdjson(redacted)
				? summarizePiJsonFailureOutput(redacted, { exitCode, classification })
				: tailed;
		return { output, logPath: null, logRef: null };
	}

	// Persist the full (redacted) stream to the lane log for operator digs.
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

	const logRef = persisted?.logRef ?? null;
	// Journal path: never dump --mode json system-prompt NDJSON into task.failed.
	const output =
		!ok && looksLikePiJsonNdjson(redacted)
			? summarizePiJsonFailureOutput(redacted, {
					exitCode,
					classification,
					logRef,
				})
			: (persisted?.output ?? tailed);

	return {
		output,
		logPath: persisted?.logPath ?? null,
		logRef,
	};
}

export {
	TRUNCATION_MARKER,
	DEFAULT_MAX_BYTES,
	DEFAULT_LIVE_LOG_MAX_BYTES,
	DEFAULT_TAIL_LINES,
};
