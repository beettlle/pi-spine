// @ts-nocheck
/**
 * Lane heartbeat and progress-aware stall helpers (FR-WORK-09, PRD §18.4, FR-STALL-02).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendJournalEvent, readJournalEventsCached } from "./journal.mjs";
import {
	resolveDebouncedScopedDirtyPaths,
	resolveFileScopeMtimeMs,
} from "./heartbeat-git-debounce.mjs";

export {
	clearGitPorcelainDebounceCache,
	getGitPorcelainCallCount,
	resetGitPorcelainCallCount,
} from "./heartbeat-git-debounce.mjs";

const DEFAULT_STALL_TIMEOUT_MIN = 60;
const DEFAULT_GRACE_AFTER_PROGRESS_MIN = 15;
const DEFAULT_HEARTBEAT_INTERVAL_MIN = 10;
const DEFAULT_CHECKPOINT_WARNING_MIN = 10;
const DEFAULT_POST_DONE_GRACE_MIN = 4;
const DEFAULT_PROGRESS_SNAPSHOT_INTERVAL_MIN = 2;
const POLL_INTERVAL_MS = 30_000;

const CHECKPOINT_WARNING_SUGGESTION =
	"Commit step work and call spine_report_progress so stall grace tracks checkpoints, not file edits alone.";

/** @typedef {"worker_alive" | "checkpoint" | "file_scope_activity"} HeartbeatKind */
/** @typedef {"launching" | "pi" | "verify" | "subprocess" | "unknown"} WorkerPhase */

/** @type {readonly HeartbeatKind[]} */
export const HEARTBEAT_KINDS = Object.freeze([
	"worker_alive",
	"checkpoint",
	"file_scope_activity",
]);

/** @type {readonly WorkerPhase[]} */
export const WORKER_PHASES = Object.freeze([
	"launching",
	"pi",
	"verify",
	"subprocess",
	"unknown",
]);

const SUBPROCESS_COMMAND_MAX_LEN = 120;

const SUBPROCESS_FRIENDLY_LABELS = Object.freeze([
	[/^npm\s+run\s+coverage(?::\w+)?/i, "coverage"],
	[/^npm\s+run\s+typecheck/i, "typecheck"],
	[/^npm\s+test\b/i, "tests"],
	[/^node\s+--test\b/i, "tests"],
]);

const SUBPROCESS_STRING_REDACT_PATTERNS = [
	/(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi,
	/sk-[a-zA-Z0-9]{20,}/g,
	/ghp_[a-zA-Z0-9]{20,}/g,
	/\b[A-Z][A-Z0-9_]*=\S+/g,
];

/**
 * @param {string} text
 */
function redactSubprocessCommandText(text) {
	let out = text;
	for (const pattern of SUBPROCESS_STRING_REDACT_PATTERNS) {
		out = out.replace(pattern, "[REDACTED]");
	}
	return out.replace(/\s+/g, " ").trim();
}

/**
 * @param {string} raw
 */
function stripLeadingEnvAssignments(command) {
	let rest = command.trim();
	while (/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/.test(rest)) {
		rest = rest.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/, "");
	}
	return rest.trim();
}

/**
 * @param {object} [config]
 */
export function resolveStallConfig(config = {}) {
	const lanes = config.lanes ?? {};
	const stallTimeoutMinutes = Number(lanes.stallTimeoutMinutes) || DEFAULT_STALL_TIMEOUT_MIN;
	const stallGraceAfterProgressMinutes =
		Number(lanes.stallGraceAfterProgressMinutes) || DEFAULT_GRACE_AFTER_PROGRESS_MIN;
	const heartbeatIntervalMinutes =
		Number(lanes.heartbeatIntervalMinutes) || DEFAULT_HEARTBEAT_INTERVAL_MIN;
	const checkpointWarningMinutes =
		Number(lanes.checkpointWarningMinutes) || DEFAULT_CHECKPOINT_WARNING_MIN;
	const postDoneGraceMinutes =
		Number(lanes.postDoneGraceMinutes) || DEFAULT_POST_DONE_GRACE_MIN;
	const progressSnapshotIntervalMinutes =
		Number(lanes.progressSnapshotIntervalMinutes) || DEFAULT_PROGRESS_SNAPSHOT_INTERVAL_MIN;

	return {
		stallTimeoutMs: stallTimeoutMinutes * 60 * 1000,
		graceAfterProgressMs: stallGraceAfterProgressMinutes * 60 * 1000,
		heartbeatIntervalMs: heartbeatIntervalMinutes * 60 * 1000,
		checkpointWarningMs: checkpointWarningMinutes * 60 * 1000,
		postDoneGraceMs: postDoneGraceMinutes * 60 * 1000,
		progressSnapshotIntervalMs: progressSnapshotIntervalMinutes * 60 * 1000,
		extendGraceOnFileScope: lanes.extendGraceOnFileScope === true,
		pollIntervalMs: POLL_INTERVAL_MS,
	};
}

/**
 * @param {string} worktreePath
 * @param {string[]} args
 */
function git(worktreePath, args) {
	try {
		return execFileSync("git", args, {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return null;
	}
}

/**
 * Scoped git porcelain paths under File Scope or the task folder (FR-STALL-02 activity).
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 * @param {string} [taskFolder]
 */
export function resolveScopedDirtyPaths(worktreePath, fileScopePaths, taskFolder) {
	const porcelain = git(worktreePath, ["status", "--porcelain"]);
	if (!porcelain) return [];

	const scopePrefixes = [];
	if (Array.isArray(fileScopePaths)) {
		for (const rel of fileScopePaths) {
			if (!rel || typeof rel !== "string") continue;
			scopePrefixes.push(rel.endsWith("/") ? rel : `${rel}/`);
			scopePrefixes.push(rel);
		}
	}
	let taskRel = null;
	if (taskFolder) {
		taskRel = path.relative(worktreePath, taskFolder);
		if (taskRel && !taskRel.startsWith("..")) {
			scopePrefixes.push(taskRel.endsWith("/") ? taskRel : `${taskRel}/`);
			scopePrefixes.push(taskRel);
		}
	}

	if (scopePrefixes.length === 0) return [];

	const inScope = (filePath) =>
		scopePrefixes.some((prefix) => filePath === prefix || filePath.startsWith(prefix));

	const dirty = new Set();
	for (const line of porcelain.split("\n")) {
		if (!line.trim()) continue;
		let filePath = line.length > 2 && line[2] === " " ? line.slice(3) : line.slice(2);
		filePath = filePath.trim();
		const renamed = filePath.includes(" -> ") ? filePath.split(" -> ").pop()?.trim() : filePath;
		if (renamed && inScope(renamed)) dirty.add(renamed);
	}
	return [...dirty].sort();
}

/**
 * @param {object[]} events
 * @param {object} filter
 * @param {number} [filter.laneNumber]
 * @param {string} [filter.laneId]
 * @param {string} [filter.taskId]
 */
export function findLatestStepCompletedMs(events, { laneNumber, laneId, taskId }) {
	let latest = null;
	const expectedLaneId =
		laneNumber != null ? `lane-${laneNumber}` : typeof laneId === "string" ? laneId : null;

	for (const event of events) {
		if (event.type !== "task.step_completed") continue;
		if (taskId && event.taskId !== taskId) continue;
		if (expectedLaneId && event.laneId && event.laneId !== expectedLaneId) continue;

		const ts = Date.parse(event.timestamp);
		if (Number.isNaN(ts)) continue;
		latest = latest === null ? ts : Math.max(latest, ts);
	}

	return latest;
}

/**
 * Redact secrets and shorten a subprocess command for heartbeat payloads.
 *
 * @param {string} raw
 */
export function redactSubprocessCommand(raw) {
	if (!raw || typeof raw !== "string") return null;
	const head = raw.split(/\s*(?:&&|;|\|)\s*/)[0]?.trim() ?? "";
	if (!head) return null;
	const withoutEnv = stripLeadingEnvAssignments(head);
	const redacted = redactSubprocessCommandText(withoutEnv);
	const trimmed =
		redacted.length > SUBPROCESS_COMMAND_MAX_LEN
			? `${redacted.slice(0, SUBPROCESS_COMMAND_MAX_LEN - 1)}…`
			: redacted;
	for (const [pattern, label] of SUBPROCESS_FRIENDLY_LABELS) {
		if (pattern.test(trimmed)) return label;
	}
	return trimmed;
}

/**
 * @param {object} event
 * @param {object} filter
 * @param {number} [filter.laneNumber]
 * @param {string} [filter.laneId]
 * @param {string} [filter.taskId]
 */
function subprocessEventMatches(event, { laneNumber, laneId, taskId }) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	const expectedLaneId =
		laneNumber != null ? `lane-${laneNumber}` : typeof laneId === "string" ? laneId : null;
	if (taskId && event.taskId && event.taskId !== taskId) return false;
	if (payload.taskId && taskId && payload.taskId !== taskId) return false;
	if (expectedLaneId && event.laneId && event.laneId !== expectedLaneId) return false;
	if (expectedLaneId && payload.laneId && payload.laneId !== expectedLaneId) return false;
	if (laneNumber != null && payload.laneNumber != null && payload.laneNumber !== laneNumber) {
		return false;
	}
	return true;
}

/**
 * Latest active subprocess signal from worker journal events (issue #134 / SP-548).
 *
 * @param {object[]} events
 * @param {object} filter
 * @param {number} [filter.laneNumber]
 * @param {string} [filter.laneId]
 * @param {string} [filter.taskId]
 */
export function findLatestSubprocessSignal(events, { laneNumber, laneId, taskId }) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (!subprocessEventMatches(event, { laneNumber, laneId, taskId })) continue;

		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const ts = Date.parse(event.timestamp);
		if (Number.isNaN(ts)) continue;

		if (event.type === "task.subprocess_ended") {
			return null;
		}

		const rawCommand =
			typeof payload.subprocessCommand === "string"
				? payload.subprocessCommand
				: typeof payload.subprocessLabel === "string"
					? payload.subprocessLabel
					: null;
		if (!rawCommand) continue;

		if (event.type === "task.subprocess_active" || event.type === "task.step_completed") {
			const subprocessCommand = redactSubprocessCommand(rawCommand);
			if (!subprocessCommand) continue;
			return { subprocessCommand, subprocessStartedAtMs: ts };
		}
	}

	return null;
}

/**
 * @param {WorkerPhase} enginePhase
 * @param {object | null | undefined} signals
 */
export function resolveEffectiveWorkerPhase(enginePhase, signals) {
	if (signals?.subprocessCommand) return "subprocess";
	return enginePhase;
}

/**
 * @param {object} params
 * @param {string[]} [params.fileScopePaths]
 * @param {object} [params.journalContext]
 * @param {string} [params.journalContext.projectRoot]
 * @param {string} [params.journalContext.batchId]
 * @param {number} [params.journalContext.laneNumber]
 * @param {string} [params.journalContext.laneId]
 * @param {string} [params.journalContext.taskId]
 */
export function collectProgressSignals({
	worktreePath,
	taskFolder,
	laneBranch,
	fileScopePaths,
	journalContext,
}) {
	const statusPath = path.join(taskFolder, "STATUS.md");
	let statusMtimeMs = null;
	if (fs.existsSync(statusPath)) {
		statusMtimeMs = fs.statSync(statusPath).mtimeMs;
	}

	let lastCommitAtMs = null;
	if (laneBranch) {
		const ts = git(worktreePath, ["log", "-1", "--format=%ct", laneBranch]);
		if (ts) {
			const parsed = Number(ts);
			if (!Number.isNaN(parsed)) lastCommitAtMs = parsed * 1000;
		}
	}

	const fileScopeMtimeMs = resolveFileScopeMtimeMs(worktreePath, fileScopePaths);
	const dirtyPaths = resolveDebouncedScopedDirtyPaths(
		worktreePath,
		fileScopePaths,
		taskFolder,
		resolveScopedDirtyPaths,
	);

	let stepCompletedAtMs = null;
	let subprocessCommand = null;
	let subprocessStartedAtMs = null;
	if (journalContext?.projectRoot && journalContext?.batchId) {
		const events = readJournalEventsCached(journalContext.projectRoot, journalContext.batchId);
		stepCompletedAtMs = findLatestStepCompletedMs(events, {
			laneNumber: journalContext.laneNumber,
			laneId: journalContext.laneId,
			taskId: journalContext.taskId,
		});
		const subprocess = findLatestSubprocessSignal(events, {
			laneNumber: journalContext.laneNumber,
			laneId: journalContext.laneId,
			taskId: journalContext.taskId,
		});
		if (subprocess) {
			subprocessCommand = subprocess.subprocessCommand;
			subprocessStartedAtMs = subprocess.subprocessStartedAtMs;
		}
	}

	return {
		statusMtimeMs,
		lastCommitAtMs,
		fileScopeMtimeMs,
		stepCompletedAtMs,
		dirtyPaths,
		subprocessCommand,
		subprocessStartedAtMs,
	};
}

/**
 * Checkpoint signals extend stall grace (STATUS, lane commit, task.step_completed).
 * @param {object | null} prev
 * @param {object} next
 */
export function checkpointSignalsChanged(prev, next) {
	if (!prev) {
		return Boolean(next.statusMtimeMs || next.lastCommitAtMs || next.stepCompletedAtMs);
	}
	if (prev.statusMtimeMs !== next.statusMtimeMs) return true;
	if (prev.lastCommitAtMs !== next.lastCommitAtMs) return true;
	if (prev.stepCompletedAtMs !== next.stepCompletedAtMs) return true;
	return false;
}

/**
 * Activity signals are warning-only unless extendGraceOnFileScope is enabled.
 * @param {object | null} prev
 * @param {object} next
 */
export function activitySignalsChanged(prev, next) {
	if (!prev) {
		return Boolean(next.fileScopeMtimeMs || (next.dirtyPaths?.length ?? 0) > 0);
	}
	if (prev.fileScopeMtimeMs !== next.fileScopeMtimeMs) return true;
	const prevDirty = (prev.dirtyPaths ?? []).join("\0");
	const nextDirty = (next.dirtyPaths ?? []).join("\0");
	if (prevDirty !== nextDirty) return true;
	return false;
}

/**
 * @param {object | null} prev
 * @param {object} next
 * @param {object} [options]
 * @param {boolean} [options.extendGraceOnFileScope]
 */
export function progressSignalsChanged(prev, next, options = {}) {
	const checkpoint = checkpointSignalsChanged(prev, next);
	if (checkpoint) return true;
	if (options.extendGraceOnFileScope) return activitySignalsChanged(prev, next);
	return false;
}

/**
 * @param {object} signals
 */
export function resolveLastCheckpointMs(signals) {
	const parts = [signals.statusMtimeMs, signals.lastCommitAtMs, signals.stepCompletedAtMs].filter(
		(v) => v != null,
	);
	if (parts.length === 0) return null;
	return Math.max(...parts);
}

/**
 * @param {object} signals
 */
export function hasActivitySignals(signals) {
	return Boolean(signals.fileScopeMtimeMs || (signals.dirtyPaths?.length ?? 0) > 0);
}

/**
 * @param {object} params
 * @param {number} params.now
 * @param {number} params.lastCheckpointAt
 * @param {object} params.signals
 * @param {object} params.stallConfig
 * @param {boolean} params.activitySinceCheckpoint
 * @param {WorkerPhase} [params.workerPhase]
 */
export function shouldEmitCheckpointWarning({
	now,
	lastCheckpointAt,
	signals,
	stallConfig,
	activitySinceCheckpoint,
	workerPhase = "unknown",
}) {
	if (workerPhase === "launching") return false;
	if (!activitySinceCheckpoint || !hasActivitySignals(signals)) return false;
	return now - lastCheckpointAt >= stallConfig.checkpointWarningMs;
}

/** @param {object} params @param {number} params.startedAt @param {number} params.lastProgressAt @param {number} [params.lastAliveAt] @param {ReturnType<typeof resolveStallConfig>} params.stallConfig */
export function computeStallDeadline({ startedAt, lastProgressAt, lastAliveAt, stallConfig }) {
	const stallAnchorAt = lastAliveAt ?? startedAt;
	return Math.max(
		stallAnchorAt + stallConfig.stallTimeoutMs,
		lastProgressAt + stallConfig.graceAfterProgressMs,
	);
}

/**
 * @param {object} params
 * @param {WorkerPhase} [params.workerPhase]
 * @param {HeartbeatKind} [params.heartbeatKind]
 */
export function resolveHeartbeatKind({
	workerPhase,
	checkpointChanged = false,
	activityChanged = false,
}) {
	if (workerPhase === "launching") return "worker_alive";
	if (checkpointChanged) return "checkpoint";
	if (activityChanged) return "file_scope_activity";
	return "worker_alive";
}

/**
 * Progress-class heartbeat fields are omitted during launcher preflight so retries
 * do not reuse stale STATUS / git checkpoint signals from a prior attempt.
 *
 * @param {object} signals
 * @param {WorkerPhase} workerPhase
 * @param {HeartbeatKind} heartbeatKind
 */
export function buildHeartbeatPayloadFields(signals, workerPhase, heartbeatKind) {
	const effectivePhase = resolveEffectiveWorkerPhase(workerPhase, signals);
	const includeProgressFields =
		effectivePhase !== "launching" &&
		(heartbeatKind === "checkpoint" || heartbeatKind === "file_scope_activity");

	/** @type {Record<string, unknown>} */
	const payload = {
		statusMtimeMs: null,
		lastCommitAtMs: null,
		fileScopeMtimeMs: null,
		dirtyPathCount: 0,
	};

	if (effectivePhase === "subprocess" && signals?.subprocessCommand) {
		payload.subprocessCommand = signals.subprocessCommand;
		payload.subprocessStartedAtMs = signals.subprocessStartedAtMs ?? null;
	}

	if (!includeProgressFields) {
		return payload;
	}

	return {
		...payload,
		statusMtimeMs: signals.statusMtimeMs,
		lastCommitAtMs: signals.lastCommitAtMs,
		fileScopeMtimeMs: signals.fileScopeMtimeMs,
		dirtyPathCount: signals.dirtyPaths?.length ?? 0,
	};
}

/**
 * Bounded lane.progress_snapshot payload (issue #48).
 *
 * @param {object} signals
 * @param {WorkerPhase} workerPhase
 */
export function buildProgressSnapshotPayload(signals, workerPhase) {
	const effectivePhase = resolveEffectiveWorkerPhase(workerPhase, signals);
	/** @type {Record<string, unknown>} */
	const payload = {
		workerPhase: effectivePhase,
		dirtyPathCount: signals.dirtyPaths?.length ?? 0,
		lastCommitAtMs: signals.lastCommitAtMs ?? null,
		statusMtimeMs: signals.statusMtimeMs ?? null,
		stepCompletedAtMs: signals.stepCompletedAtMs ?? null,
	};
	if (effectivePhase === "subprocess" && signals?.subprocessCommand) {
		payload.subprocessCommand = signals.subprocessCommand;
		payload.subprocessStartedAtMs = signals.subprocessStartedAtMs ?? null;
	}
	return payload;
}

/**
 * @param {object | null} prev
 * @param {object} next
 */
export function progressSnapshotPayloadChanged(prev, next) {
	if (!prev) return true;
	if (prev.workerPhase !== next.workerPhase) return true;
	if (prev.dirtyPathCount !== next.dirtyPathCount) return true;
	if (prev.lastCommitAtMs !== next.lastCommitAtMs) return true;
	if (prev.statusMtimeMs !== next.statusMtimeMs) return true;
	if (prev.stepCompletedAtMs !== next.stepCompletedAtMs) return true;
	if (prev.subprocessCommand !== next.subprocessCommand) return true;
	if (prev.subprocessStartedAtMs !== next.subprocessStartedAtMs) return true;
	return false;
}

/**
 * @param {object} params
 * @param {number} params.now
 * @param {number} params.lastEmittedAt
 * @param {number} params.intervalMs
 */
export function shouldEmitProgressSnapshot({ now, lastEmittedAt, intervalMs }) {
	if (!intervalMs || intervalMs <= 0) return false;
	return now - lastEmittedAt >= intervalMs;
}

/**
 * @param {object} params
 */
export function recordLaneProgressSnapshot({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	signals,
	correlationId,
	workerPhase = "unknown",
}) {
	const effectivePhase = resolveEffectiveWorkerPhase(workerPhase, signals);
	const snapshot = buildProgressSnapshotPayload(signals, workerPhase);
	appendJournalEvent(projectRoot, batchId, "lane.progress_snapshot", {
		laneNumber,
		taskId,
		correlationId,
		...snapshot,
	});
}

/**
 * @param {object} params
 * @param {WorkerPhase} [params.workerPhase]
 * @param {HeartbeatKind} [params.heartbeatKind]
 */
export function recordLaneHeartbeat({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	signals,
	correlationId,
	workerPhase = "unknown",
	heartbeatKind = "worker_alive",
}) {
	const effectivePhase = resolveEffectiveWorkerPhase(workerPhase, signals);
	const progressFields = buildHeartbeatPayloadFields(signals, workerPhase, heartbeatKind);
	appendJournalEvent(projectRoot, batchId, "lane.heartbeat", {
		laneNumber,
		taskId,
		correlationId,
		heartbeatKind,
		workerPhase: effectivePhase,
		...progressFields,
	});
}

/**
 * @param {object} params
 */
export function recordCheckpointWarning({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	signals,
	lastCheckpointAt,
	correlationId,
}) {
	appendJournalEvent(projectRoot, batchId, "lane.checkpoint_warning", {
		laneNumber,
		taskId,
		correlationId,
		lastCheckpointAt,
		statusMtimeMs: signals.statusMtimeMs,
		lastCommitAtMs: signals.lastCommitAtMs,
		fileScopeMtimeMs: signals.fileScopeMtimeMs,
		stepCompletedAtMs: signals.stepCompletedAtMs,
		dirtyPaths: signals.dirtyPaths ?? [],
		suggestion: CHECKPOINT_WARNING_SUGGESTION,
	});
}

/**
 * @param {object} params
 */
export function recordStallWarning({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	signals,
	stallDeadline,
	correlationId,
}) {
	appendJournalEvent(projectRoot, batchId, "lane.stall_warning", {
		laneNumber,
		taskId,
		correlationId,
		stallDeadline,
		statusMtimeMs: signals.statusMtimeMs,
		lastCommitAtMs: signals.lastCommitAtMs,
		fileScopeMtimeMs: signals.fileScopeMtimeMs,
	});
}

export { CHECKPOINT_WARNING_SUGGESTION, POLL_INTERVAL_MS };
