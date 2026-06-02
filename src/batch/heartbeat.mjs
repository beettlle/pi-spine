/**
 * Lane heartbeat and progress-aware stall helpers (FR-WORK-09, PRD §18.4).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendJournalEvent } from "./journal.mjs";

const DEFAULT_STALL_TIMEOUT_MIN = 60;
const DEFAULT_GRACE_AFTER_PROGRESS_MIN = 15;
const DEFAULT_HEARTBEAT_INTERVAL_MIN = 10;
const POLL_INTERVAL_MS = 30_000;

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

	return {
		stallTimeoutMs: stallTimeoutMinutes * 60 * 1000,
		graceAfterProgressMs: stallGraceAfterProgressMinutes * 60 * 1000,
		heartbeatIntervalMs: heartbeatIntervalMinutes * 60 * 1000,
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
 * Max mtime among existing file-scope paths (FR-WORK-10 warning signal; extends stall grace).
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
 * @param {object} params
 * @param {string[]} [params.fileScopePaths]
 */
export function collectProgressSignals({ worktreePath, taskFolder, laneBranch, fileScopePaths }) {
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

	return { statusMtimeMs, lastCommitAtMs, fileScopeMtimeMs };
}

/**
 * @param {object | null} prev
 * @param {object} next
 */
export function progressSignalsChanged(prev, next) {
	if (!prev) {
		return Boolean(next.statusMtimeMs || next.lastCommitAtMs || next.fileScopeMtimeMs);
	}
	if (prev.statusMtimeMs !== next.statusMtimeMs) return true;
	if (prev.lastCommitAtMs !== next.lastCommitAtMs) return true;
	if (prev.fileScopeMtimeMs !== next.fileScopeMtimeMs) return true;
	return false;
}

/**
 * @param {object} params
 */
export function computeStallDeadline({ startedAt, lastProgressAt, stallConfig }) {
	const hardDeadline = startedAt + stallConfig.stallTimeoutMs;
	const progressDeadline = lastProgressAt + stallConfig.graceAfterProgressMs;
	return Math.max(hardDeadline, progressDeadline);
}

/**
 * @param {object} params
 */
export function recordLaneHeartbeat({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	signals,
	correlationId,
}) {
	appendJournalEvent(projectRoot, batchId, "lane.heartbeat", {
		laneNumber,
		taskId,
		correlationId,
		statusMtimeMs: signals.statusMtimeMs,
		lastCommitAtMs: signals.lastCommitAtMs,
		fileScopeMtimeMs: signals.fileScopeMtimeMs,
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

export { POLL_INTERVAL_MS };
