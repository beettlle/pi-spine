// @ts-nocheck
/**
 * Lane heartbeat and progress-aware stall helpers (FR-WORK-09, PRD §18.4, FR-STALL-02).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendJournalEvent, readJournalEventsCached } from "./journal.mjs";

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
/** @typedef {"launching" | "pi" | "verify" | "unknown"} WorkerPhase */

/** @type {readonly HeartbeatKind[]} */
export const HEARTBEAT_KINDS = Object.freeze([
	"worker_alive",
	"checkpoint",
	"file_scope_activity",
]);

/** @type {readonly WorkerPhase[]} */
export const WORKER_PHASES = Object.freeze(["launching", "pi", "verify", "unknown"]);

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
 * Max mtime among existing file-scope paths (FR-WORK-10 activity signal; warning only by default).
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 */
function resolveFileScopeMtimeMs(worktreePath, fileScopePaths) {
	if (!Array.isArray(fileScopePaths) || fileScopePaths.length === 0) return null;
	let max = null;
	for (const rel of fileScopePaths) {
		if (!rel || typeof rel !== "string") continue;
		const target = path.join(worktreePath, rel);
		if (!fs.existsSync(target)) continue;
		const stat = fs.statSync(target);
		if (!stat.isFile()) continue;
		max = max === null ? stat.mtimeMs : Math.max(max, stat.mtimeMs);
	}
	return max;
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
	const dirtyPaths = resolveScopedDirtyPaths(worktreePath, fileScopePaths, taskFolder);

	let stepCompletedAtMs = null;
	if (journalContext?.projectRoot && journalContext?.batchId) {
		const events = readJournalEventsCached(journalContext.projectRoot, journalContext.batchId);
		stepCompletedAtMs = findLatestStepCompletedMs(events, {
			laneNumber: journalContext.laneNumber,
			laneId: journalContext.laneId,
			taskId: journalContext.taskId,
		});
	}

	return {
		statusMtimeMs,
		lastCommitAtMs,
		fileScopeMtimeMs,
		stepCompletedAtMs,
		dirtyPaths,
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
	const includeProgressFields =
		workerPhase !== "launching" &&
		(heartbeatKind === "checkpoint" || heartbeatKind === "file_scope_activity");

	if (!includeProgressFields) {
		return {
			statusMtimeMs: null,
			lastCommitAtMs: null,
			fileScopeMtimeMs: null,
			dirtyPathCount: 0,
		};
	}

	return {
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
	return {
		workerPhase,
		dirtyPathCount: signals.dirtyPaths?.length ?? 0,
		lastCommitAtMs: signals.lastCommitAtMs ?? null,
		statusMtimeMs: signals.statusMtimeMs ?? null,
		stepCompletedAtMs: signals.stepCompletedAtMs ?? null,
	};
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
	const progressFields = buildHeartbeatPayloadFields(signals, workerPhase, heartbeatKind);
	appendJournalEvent(projectRoot, batchId, "lane.heartbeat", {
		laneNumber,
		taskId,
		correlationId,
		heartbeatKind,
		workerPhase,
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
