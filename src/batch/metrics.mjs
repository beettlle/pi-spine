/**
 * Append-only run-metrics.jsonl writer (handoff §6.5, SP-158).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { METRICS_DEFAULTS } from "../config/defaults.mjs";
import { readReviewLevel } from "./review.mjs";

const REDACT_KEY_PATTERN = /key|token|secret|password|prompt/i;

/**
 * @param {object} config
 */
export function isMetricsEnabled(config = {}) {
	return config?.metrics?.enabled !== false;
}

/**
 * @param {string} projectRoot
 * @param {object} [config]
 */
export function metricsFilePath(projectRoot, config = {}) {
	const relPath = config?.metrics?.path ?? METRICS_DEFAULTS.path;
	return path.join(projectRoot, relPath);
}

/**
 * True when the only dirty path is the configured metrics file and working tree is append-only vs HEAD.
 *
 * @param {string} projectRoot
 * @param {string[]} dirtyPaths Trimmed paths from `git status --porcelain` (no status prefix).
 * @param {string} [metricsRelPath]
 * @returns {{ ok: boolean, reason?: string, metricsPath?: string }}
 */
export function isRunMetricsAppendOnlyDrift(
	projectRoot,
	dirtyPaths,
	metricsRelPath = METRICS_DEFAULTS.path,
) {
	const normalizedDirty = (dirtyPaths ?? [])
		.map((entry) => String(entry).trim().replace(/\\/g, "/"))
		.filter(Boolean);
	if (normalizedDirty.length !== 1) {
		return { ok: false, reason: "not_metrics_only" };
	}

	const normalizedMetrics = String(metricsRelPath).trim().replace(/\\/g, "/");
	const dirtyPath = normalizedDirty[0].replace(/\\/g, "/");
	if (dirtyPath !== normalizedMetrics) {
		return { ok: false, reason: "not_metrics_path" };
	}

	const filePath = path.join(projectRoot, normalizedMetrics);
	if (!fs.existsSync(filePath)) {
		return { ok: false, reason: "metrics_missing" };
	}

	let headText = "";
	try {
		headText = execFileSync("git", ["show", `HEAD:${normalizedMetrics}`], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
	} catch {
		return { ok: false, reason: "no_head_metrics" };
	}

	const workText = fs.readFileSync(filePath, "utf-8");
	if (!workText.startsWith(headText)) {
		return { ok: false, reason: "non_append_change" };
	}

	return { ok: true, metricsPath: normalizedMetrics };
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function redactMetricValue(value) {
	if (value == null || typeof value !== "object") return value;
	if (Array.isArray(value)) {
		return value.map((entry) => redactMetricValue(entry));
	}

	/** @type {Record<string, unknown>} */
	const out = {};
	for (const [key, entry] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
		if (REDACT_KEY_PATTERN.test(key)) {
			out[key] = "[REDACTED]";
		} else if (entry && typeof entry === "object") {
			out[key] = redactMetricValue(entry);
		} else {
			out[key] = entry;
		}
	}
	return out;
}

/**
 * @param {object} record
 */
export function sanitizeMetricRecord(record) {
	return /** @type {typeof record} */ (redactMetricValue(record));
}

/**
 * @param {object} task
 * @returns {"completed" | "failed" | "skipped"}
 */
export function resolveTaskMetricOutcome(task) {
	if (task.exitReason === "skipped_done_on_disk" || task.status === "skipped") {
		return "skipped";
	}
	if (task.status === "succeeded") {
		return "completed";
	}
	return "failed";
}

/**
 * @param {object} params
 * @param {string} params.batchId
 * @param {object} params.task
 * @param {object} [params.config]
 * @param {string} [params.taskFolder]
 */
export function buildTaskMetricRecord({ batchId, task, config = {}, taskFolder, laneNumber }) {
	const worker = config?.agents?.worker ?? {};
	const reviewLevel = taskFolder ? readReviewLevel(taskFolder) : Number(task.reviewLevel ?? 0);
	const startedMs = Number(task.startedAt ?? Date.now());
	const endedMs = Number(task.endedAt ?? Date.now());
	const resolvedLaneNumber =
		laneNumber ?? (Number.isFinite(task.laneNumber) ? task.laneNumber : undefined);

	/** @type {Record<string, unknown>} */
	const record = {
		recordType: "task",
		schemaVersion: 1,
		batchId,
		taskId: task.taskId,
		agentRole: "worker",
		model: typeof worker.model === "string" ? worker.model : "inherit",
		thinking:
			worker.thinking === "off" ||
			worker.thinking === "low" ||
			worker.thinking === "medium" ||
			worker.thinking === "high"
				? worker.thinking
				: "high",
		startedAt: new Date(startedMs).toISOString(),
		endedAt: new Date(endedMs).toISOString(),
		outcome: resolveTaskMetricOutcome(task),
	};

	if (Number.isFinite(resolvedLaneNumber) && resolvedLaneNumber > 0) {
		record.laneNumber = resolvedLaneNumber;
	}
	if (Number.isFinite(startedMs) && Number.isFinite(endedMs)) {
		record.durationMs = Math.max(0, endedMs - startedMs);
	}
	if (task.exitReason) record.exitReason = task.exitReason;
	if (reviewLevel > 0) record.reviewLevel = reviewLevel;
	if (task.finalVerdict != null) record.finalVerdict = task.finalVerdict;
	if (task.finalAttempts != null) record.finalAttempts = task.finalAttempts;
	if (task.contractOk != null) record.contractOk = task.contractOk;
	if (task.stallKilled === true) record.stallKilled = true;

	return sanitizeMetricRecord(record);
}

/**
 * @param {string} projectRoot
 * @param {object} record
 * @param {object} [config]
 */
export function appendTaskMetric(projectRoot, record, config = {}) {
	if (!isMetricsEnabled(config)) return null;

	const filePath = metricsFilePath(projectRoot, config);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const line = `${JSON.stringify(sanitizeMetricRecord(record))}\n`;
	fs.appendFileSync(filePath, line, "utf-8");
	return record;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} params.task
 * @param {object} [params.config]
 * @param {string} [params.taskFolder]
 */
export function recordTaskTerminalMetric({
	projectRoot,
	batchId,
	task,
	config = {},
	taskFolder,
	laneNumber,
}) {
	if (!isMetricsEnabled(config)) return null;
	const record = buildTaskMetricRecord({ batchId, task, config, taskFolder, laneNumber });
	return appendTaskMetric(projectRoot, record, config);
}

/**
 * @param {object} params
 * @param {string} params.batchId
 * @param {object} params.batchState
 * @param {string} params.diagnosis
 */
export function buildBatchMetricRecord({ batchId, batchState, diagnosis }) {
	const tasks = Array.isArray(batchState?.tasks) ? batchState.tasks : [];
	const startedAt = Number(batchState?.startedAt ?? Date.now());
	const endedAt = Number(batchState?.endedAt ?? Date.now());

	return sanitizeMetricRecord({
		recordType: "batch",
		schemaVersion: 1,
		batchId,
		endedAt: new Date(endedAt).toISOString(),
		diagnosis: diagnosis ?? "unknown",
		taskCount: tasks.length,
		completedTasks: tasks.filter(
			(task) => task.status === "succeeded" || task.exitReason === "skipped_done_on_disk",
		).length,
		failedTasks: tasks.filter((task) => task.status === "failed" || task.status === "aborted").length,
		durationMs: Math.max(0, endedAt - startedAt),
	});
}

/**
 * @param {string} projectRoot
 * @param {object} record
 * @param {object} [config]
 */
export function appendBatchMetric(projectRoot, record, config = {}) {
	if (!isMetricsEnabled(config)) return null;

	const filePath = metricsFilePath(projectRoot, config);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const line = `${JSON.stringify(sanitizeMetricRecord(record))}\n`;
	fs.appendFileSync(filePath, line, "utf-8");
	return record;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} params.batchState
 * @param {string} params.diagnosis
 * @param {object} [params.config]
 */
export function recordBatchTerminalMetric({
	projectRoot,
	batchId,
	batchState,
	diagnosis,
	config = {},
}) {
	if (!isMetricsEnabled(config)) return null;
	const record = buildBatchMetricRecord({ batchId, batchState, diagnosis });
	return appendBatchMetric(projectRoot, record, config);
}

/**
 * @param {string} filePath
 * @param {object} [options]
 */
export function readMetricsLines(filePath, options = {}) {
	if (!fs.existsSync(filePath)) return [];
	const raw = fs.readFileSync(filePath, "utf-8").trim();
	if (!raw) return [];

	/** @type {object[]} */
	const lines = [];
	for (const line of raw.split("\n")) {
		if (!line.trim()) continue;
		try {
			lines.push(JSON.parse(line));
		} catch {
			if (!options.skipInvalid) throw new Error(`Invalid metrics JSONL line in ${filePath}`);
		}
	}
	return lines;
}

/**
 * @param {object[]} lines
 * @param {object} [filters]
 */
export function filterMetricsLines(lines, filters = {}) {
	let filtered = [...lines];
	if (filters.batchId) {
		filtered = filtered.filter((line) => line.batchId === filters.batchId);
	}
	if (filters.last != null && Number.isFinite(filters.last) && filters.last > 0) {
		filtered = filtered.slice(-filters.last);
	}
	return filtered;
}

/**
 * @param {object[]} lines
 */
export function formatMetricsTable(lines) {
	if (lines.length === 0) return "No metrics records found.\n";

	const header = ["Type", "Batch", "Task", "Outcome", "Diagnosis", "Ended"];
	const rows = lines.map((line) => [
		line.recordType ?? "—",
		line.batchId ?? "—",
		line.taskId ?? "—",
		line.outcome ?? line.diagnosis ?? "—",
		line.diagnosis ?? "—",
		line.endedAt ?? "—",
	]);

	const widths = header.map((col, index) =>
		Math.max(col.length, ...rows.map((row) => String(row[index] ?? "").length)),
	);

	const formatRow = (row) =>
		row.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ");

	return `${[formatRow(header), ...rows.map(formatRow)].join("\n")}\n`;
}
