/**
 * Append-only orchestration journal (FR-JRN, PRD §11).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const JOURNAL_SCHEMA_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 32 * 1024;

const META_KEYS = new Set(["correlationId", "laneId", "laneNumber", "taskId", "payload"]);

const REDACT_KEY_PATTERN = /key|token|secret|password/i;

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function journalPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "journal", "events.jsonl");
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactSecrets(value) {
	if (value == null || typeof value !== "object") return value;

	if (Array.isArray(value)) {
		return value.map((entry) => redactSecrets(entry));
	}

	/** @type {Record<string, unknown>} */
	const out = {};
	for (const [key, entry] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
		if (REDACT_KEY_PATTERN.test(key)) {
			out[key] = "[REDACTED]";
		} else if (entry && typeof entry === "object") {
			out[key] = redactSecrets(entry);
		} else {
			out[key] = entry;
		}
	}
	return out;
}

/**
 * @param {Record<string, unknown>} payload
 */
export function capPayloadSize(payload) {
	let serialized = JSON.stringify(payload);
	if (Buffer.byteLength(serialized, "utf-8") <= MAX_PAYLOAD_BYTES) {
		return payload;
	}

	const truncated = {
		_truncated: true,
		_originalBytes: Buffer.byteLength(serialized, "utf-8"),
		_maxBytes: MAX_PAYLOAD_BYTES,
		preview: serialized.slice(0, MAX_PAYLOAD_BYTES - 256),
	};
	return truncated;
}

/**
 * @param {Record<string, unknown>} options
 */
function extractPayload(options) {
	if (options.payload && typeof options.payload === "object" && !Array.isArray(options.payload)) {
		return { .../** @type {Record<string, unknown>} */ (options.payload) };
	}

	/** @type {Record<string, unknown>} */
	const payload = {};
	for (const [key, value] of Object.entries(options)) {
		if (!META_KEYS.has(key)) payload[key] = value;
	}
	return payload;
}

/**
 * @param {Record<string, unknown>} options
 */
function resolveLaneId(options) {
	if (typeof options.laneId === "string" && options.laneId) return options.laneId;
	if (options.laneNumber != null) return `lane-${options.laneNumber}`;
	return undefined;
}

/**
 * @param {object} line
 * @returns {object}
 */
export function normalizeJournalEvent(line) {
	if (!line || typeof line !== "object") return line;

	if (line.schemaVersion === JOURNAL_SCHEMA_VERSION) {
		return line;
	}

	/** @type {Record<string, unknown>} */
	const legacy = /** @type {Record<string, unknown>} */ (line);
	const { type, batchId, timestamp, correlationId, laneId, taskId, ...rest } = legacy;

	let isoTimestamp;
	if (typeof timestamp === "number") {
		isoTimestamp = new Date(timestamp).toISOString();
	} else if (typeof timestamp === "string") {
		isoTimestamp = timestamp;
	} else {
		isoTimestamp = new Date().toISOString();
	}

	return {
		schemaVersion: JOURNAL_SCHEMA_VERSION,
		eventId: typeof legacy.eventId === "string" ? legacy.eventId : `legacy-${isoTimestamp}`,
		type,
		timestamp: isoTimestamp,
		batchId,
		correlationId: typeof correlationId === "string" ? correlationId : undefined,
		laneId: typeof laneId === "string" ? laneId : resolveLaneId(legacy),
		taskId: typeof taskId === "string" ? taskId : undefined,
		payload: rest,
		_legacy: true,
	};
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} type
 * @param {Record<string, unknown>} [options]
 */
export function appendJournalEvent(projectRoot, batchId, type, options = {}) {
	const filePath = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });

	const rawPayload = extractPayload(options);
	const payload = capPayloadSize(redactSecrets(rawPayload));

	const entry = {
		schemaVersion: JOURNAL_SCHEMA_VERSION,
		eventId: crypto.randomUUID(),
		type,
		timestamp: new Date().toISOString(),
		batchId,
		payload,
	};

	const correlationId = options.correlationId;
	if (typeof correlationId === "string" && correlationId) {
		entry.correlationId = correlationId;
	}

	const laneId = resolveLaneId(options);
	if (laneId) entry.laneId = laneId;

	const taskId = options.taskId;
	if (typeof taskId === "string" && taskId) entry.taskId = taskId;

	const line = `${JSON.stringify(entry)}\n`;
	fs.appendFileSync(filePath, line, "utf-8");

	const fd = fs.openSync(filePath, "r+");
	try {
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}

	return entry;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {object[]}
 */
export function readJournalEvents(projectRoot, batchId) {
	const filePath = journalPath(projectRoot, batchId);
	if (!fs.existsSync(filePath)) return [];

	return fs
		.readFileSync(filePath, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => normalizeJournalEvent(JSON.parse(line)));
}

/**
 * @param {object[]} events
 * @param {number} [limit]
 */
export function readJournalTail(events, limit = 50) {
	if (events.length <= limit) return events;
	return events.slice(-limit);
}

/**
 * @param {object} event
 */
export function summarizeJournalEvent(event) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	const parts = [];

	if (payload.reason) parts.push(String(payload.reason));
	if (payload.error) parts.push(String(payload.error).slice(0, 80));
	if (payload.classification) parts.push(String(payload.classification));
	if (payload.mergeCommit) parts.push(`merge ${String(payload.mergeCommit).slice(0, 8)}`);
	if (payload.baseBranch && payload.orchBranch) {
		parts.push(`${payload.baseBranch} → ${payload.orchBranch}`);
	}
	if (payload.worktreePath) parts.push(String(payload.worktreePath).split("/").slice(-2).join("/"));
	if (payload.verdict) parts.push(String(payload.verdict));
	if (payload.reviewType) parts.push(`${payload.reviewType} review`);
	if (payload.diagnosis) parts.push(String(payload.diagnosis));
	if (payload.stallDeadline) parts.push(`stall deadline ${payload.stallDeadline}`);
	if (payload.changedFileCount != null) {
		parts.push(`${payload.changedFileCount} scoped file(s)`);
	}
	if (payload.retryCommand) parts.push(String(payload.retryCommand));
	if (payload.recommendedAction && !payload.retryCommand) {
		parts.push(String(payload.recommendedAction));
	}
	if (Array.isArray(payload.dirtyPaths) && payload.dirtyPaths.length > 0) {
		const listed = payload.dirtyPaths.slice(0, 3).join(", ");
		const more =
			payload.dirtyPaths.length > 3 ? ` (+${payload.dirtyPaths.length - 3} more)` : "";
		parts.push(`dirty: ${listed}${more}`);
	}
	if (payload.suggestion) parts.push(String(payload.suggestion).slice(0, 80));

	if (parts.length === 0 && Object.keys(payload).length > 0) {
		const preview = JSON.stringify(payload);
		return preview.length > 60 ? `${preview.slice(0, 57)}…` : preview;
	}

	return parts.join("; ") || "—";
}

/**
 * @param {object[]} events
 */
const JOURNAL_HINT_RECENT_MS = 30 * 60 * 1000;

/**
 * @param {string|undefined} timestamp
 */
function isRecentJournalHint(timestamp) {
	if (!timestamp) return false;
	const ts = Date.parse(timestamp);
	if (Number.isNaN(ts)) return false;
	return Date.now() - ts < JOURNAL_HINT_RECENT_MS;
}

/**
 * @param {object[]} events
 */
export function extractJournalDiagnosisHints(events) {
	const tail = readJournalTail(events);
	const hints = [];

	const priority = [
		"batch.failed",
		"task.failed",
		"review.failed",
		"lane.salvage_inspection",
		"lane.checkpoint_warning",
		"lane.stall_warning",
		"lane.died",
	];
	for (const type of priority) {
		const match = [...tail].reverse().find((event) => {
			if (event.type !== type) return false;
			if (type === "lane.checkpoint_warning") return isRecentJournalHint(event.timestamp);
			return true;
		});
		if (match) {
			hints.push({
				type: match.type,
				timestamp: match.timestamp,
				summary: summarizeJournalEvent(match),
				eventId: match.eventId,
			});
		}
	}

	return hints;
}
