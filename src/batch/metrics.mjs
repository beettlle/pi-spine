// @ts-nocheck
/**
 * Append-only run-metrics.jsonl writer (handoff §6.5, SP-158).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveReviewerModelPin, resolveReviewerThinkingPin } from "../config/agent-model-resolve.mjs";
import { METRICS_DEFAULTS } from "../config/defaults.mjs";
import { redactSecretsDeep } from "../util/secret-redact.mjs";
import { readReviewLevel } from "./review.mjs";

// Metrics additionally redacts prompt text (worker prompts may embed
// secrets) while preserving usage counters for cost rollup.
const METRICS_REDACT_KEY_PATTERN = /key|token|secret|password|prompt/i;
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];
const USAGE_KEYS = new Set(["tokensIn", "tokensOut", "estimatedUsd"]);

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
 * Redact secret-like fields via the shared policy (SP-716), keeping the
 * metrics-specific prompt denylist and usage-counter exemptions.
 *
 * @param {object} record
 */
export function sanitizeMetricRecord(record) {
	return /** @type {typeof record} */ (
		redactSecretsDeep(record, {
			keyPattern: METRICS_REDACT_KEY_PATTERN,
			allowedKeys: USAGE_KEYS,
		})
	);
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
		// SP-808 (#329): SP-809 pins task.workerModel to the model actually used
		// (fallback profile after a hop); prefer it over the batch-start config.
		model:
			typeof task.workerModel === "string" && task.workerModel !== ""
				? task.workerModel
				: typeof worker.model === "string"
					? worker.model
					: "inherit",
		// SP-835 (#340): prefer the per-attempt pin (`**Thinking:**` / profile) over batch-start config.
		thinking: [task.workerThinking, worker.thinking].find((level) => THINKING_LEVELS.includes(level)) ?? "high",
		startedAt: new Date(startedMs).toISOString(),
		endedAt: new Date(endedMs).toISOString(),
		outcome: resolveTaskMetricOutcome(task),
	};

	if (typeof task.workerProfile === "string" && task.workerProfile !== "") {
		record.profile = task.workerProfile;
	}
	if (Number.isFinite(resolvedLaneNumber) && resolvedLaneNumber > 0) {
		record.laneNumber = resolvedLaneNumber;
	}
	if (Number.isFinite(startedMs) && Number.isFinite(endedMs)) {
		record.durationMs = Math.max(0, endedMs - startedMs);
	}
	if (task.exitReason) record.exitReason = task.exitReason;
	if (task.exitReason === "contract_failed") record.failureKind = "contract";
	if (task.exitReason === "review_exhausted") record.failureKind = "reviewer";
	// SP-806 (#329): provider quota/overload exits carry their own failure kind
	// so doctor quota-risk signals can fire on run-metrics without extra config.
	if (task.exitReason === "provider_quota_exhausted" || task.exitReason === "provider_overloaded") {
		record.failureKind = "quota";
	}
	if (reviewLevel > 0) record.reviewLevel = reviewLevel;
	if (task.finalVerdict != null) record.finalVerdict = task.finalVerdict;
	if (task.finalAttempts != null) record.finalAttempts = task.finalAttempts;
	if (task.contractOk != null) record.contractOk = task.contractOk;
	if (task.stallKilled === true) record.stallKilled = true;
	if (Number.isFinite(task.tokensIn)) record.tokensIn = task.tokensIn;
	if (Number.isFinite(task.tokensOut)) record.tokensOut = task.tokensOut;
	if (Number.isFinite(task.estimatedUsd)) record.estimatedUsd = task.estimatedUsd;
	if (typeof task.role === "string") record.role = task.role;

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

/** Reviewer row outcomes: a recorded verdict, or why no verdict was produced. */
export const REVIEW_METRIC_OUTCOMES = Object.freeze([
	"verdict",
	"spawn_failed",
	"timeout",
	"provider_error",
	"blocked",
]);

/**
 * Effective reviewer pins for a review type on the config the review ran with
 * (`"inherit"` when the pin resolves to null).
 *
 * @param {object} config
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {{ model: string, thinking: string }}
 */
export function resolveReviewMetricPins(config, reviewType) {
	return {
		model: resolveReviewerModelPin(config, reviewType) ?? "inherit",
		thinking: resolveReviewerThinkingPin(config, reviewType) ?? "inherit",
	};
}

/**
 * One `recordType: "review"` row per reviewer verdict or reviewer failure (SP-837 / #325).
 *
 * @param {object} params
 * @param {string} params.batchId
 * @param {string} params.taskId
 * @param {number} [params.laneNumber]
 * @param {"plan"|"code"|"final"} params.reviewType
 * @param {number} [params.stepNumber] Plan/code review step (code/plan reviews are per task today).
 * @param {string} [params.model]
 * @param {string} [params.thinking]
 * @param {string} [params.profile]
 * @param {string} [params.verdict] Recorded verdict (APPROVE/PASS/REVISE/REPLAN) for `outcome: "verdict"`.
 * @param {number} [params.attempt] 1-based review attempt index.
 * @param {number} [params.durationMs]
 * @param {"verdict"|"spawn_failed"|"timeout"|"provider_error"|"blocked"} [params.outcome]
 * @param {string} [params.failureReason]
 * @param {number} [params.endedAtMs]
 */
export function buildReviewMetricRecord({
	batchId,
	taskId,
	laneNumber,
	reviewType,
	stepNumber,
	model,
	thinking,
	profile,
	verdict,
	attempt,
	durationMs,
	outcome = "verdict",
	failureReason,
	endedAtMs = Date.now(),
}) {
	/** @type {Record<string, unknown>} */
	const record = {
		recordType: "review",
		schemaVersion: 1,
		batchId,
		taskId,
		agentRole: "reviewer",
		role: "reviewer",
		reviewType,
		model: typeof model === "string" && model !== "" ? model : "inherit",
		thinking: THINKING_LEVELS.includes(/** @type {string} */ (thinking)) ? thinking : "inherit",
		endedAt: new Date(endedAtMs).toISOString(),
		outcome: REVIEW_METRIC_OUTCOMES.includes(outcome) ? outcome : "verdict",
	};

	if (Number.isFinite(laneNumber) && /** @type {number} */ (laneNumber) > 0) record.laneNumber = laneNumber;
	if (Number.isFinite(stepNumber)) record.stepNumber = stepNumber;
	if (typeof profile === "string" && profile !== "") record.profile = profile;
	if (typeof verdict === "string" && verdict !== "") record.verdict = verdict;
	if (Number.isFinite(attempt)) record.attempt = attempt;
	if (Number.isFinite(durationMs)) record.durationMs = Math.max(0, /** @type {number} */ (durationMs));
	if (typeof failureReason === "string" && failureReason !== "") record.failureReason = failureReason;

	return sanitizeMetricRecord(record);
}

/**
 * @param {string} projectRoot
 * @param {object} record
 * @param {object} [config]
 */
export function appendReviewMetric(projectRoot, record, config = {}) {
	return appendTaskMetric(projectRoot, record, config);
}

/**
 * Build and append a reviewer row, resolving model/thinking from the pins on
 * the config the review ran with. No-op when `metrics.enabled` is false.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} [params.config] Per-task review config (effective reviewer pins).
 * @param {"plan"|"code"|"final"} params.reviewType
 * @param {string} params.batchId
 * @param {string} params.taskId
 * @param {number} [params.laneNumber]
 * @param {number} [params.stepNumber]
 * @param {string} [params.model] Overrides the config-resolved model.
 * @param {string} [params.verdict]
 * @param {number} [params.attempt]
 * @param {number} [params.durationMs]
 * @param {"verdict"|"spawn_failed"|"timeout"|"provider_error"|"blocked"} [params.outcome]
 * @param {string} [params.failureReason]
 */
export function recordReviewMetric({ projectRoot, config = {}, model, ...rest }) {
	if (!isMetricsEnabled(config)) return null;
	const pins = resolveReviewMetricPins(config, rest.reviewType);
	const record = buildReviewMetricRecord({ ...rest, model: model ?? pins.model, thinking: pins.thinking });
	return appendReviewMetric(projectRoot, record, config);
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
		line.recordType === "review" && typeof line.reviewType === "string"
			? `review:${line.reviewType}`
			: (line.recordType ?? "—"),
		line.batchId ?? "—",
		line.taskId ?? "—",
		(line.recordType === "review" && line.outcome === "verdict" ? line.verdict : null) ??
			line.outcome ??
			line.diagnosis ??
			"—",
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
