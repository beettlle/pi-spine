/**
 * FR-STALL-03A/03B: salvage inspection and optional WIP commit on stall (no `.DONE`).
 *
 * Scope (intentionally narrow): paths listed in the task File Scope plus everything
 * under the task folder in the lane worktree — not the full worktree (see brief OQ #3).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { resolveScopedDirtyPaths } from "./heartbeat.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { evidenceDir } from "./evidence.mjs";

const INDEX_CONFLICT_PORCELAIN = /^(UU|AA|DD|AU|UA|DU|UD)/;

/**
 * @param {object} [config]
 */
export function resolveSalvageConfig(config = {}) {
	const lanes = config.lanes ?? {};
	return {
		autoCommitOnStall: lanes.autoCommitOnStall === true,
	};
}

/**
 * @param {string} worktreePath
 * @param {string[]} paths
 */
function readScopedDiffStat(worktreePath, paths) {
	if (paths.length === 0) return "";
	try {
		return execFileSync("git", ["diff", "--stat", "--", ...paths], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return "";
	}
}

/**
 * @param {string} worktreePath
 * @param {string[]} args
 */
function git(worktreePath, args) {
	return execFileSync("git", args, {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/**
 * @param {string} worktreePath
 */
export function hasWorktreeIndexConflicts(worktreePath) {
	for (const ref of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"]) {
		try {
			execFileSync("git", ["rev-parse", "-q", "--verify", ref], {
				cwd: worktreePath,
				stdio: ["ignore", "pipe", "pipe"],
			});
			return true;
		} catch {
			// not in this in-progress operation
		}
	}

	try {
		const unmerged = execFileSync("git", ["ls-files", "-u"], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		if (unmerged) return true;
	} catch {
		return false;
	}

	let porcelain = "";
	try {
		porcelain = execFileSync("git", ["status", "--porcelain"], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		return false;
	}
	for (const line of porcelain.split("\n")) {
		if (!line.trim()) continue;
		if (INDEX_CONFLICT_PORCELAIN.test(line)) return true;
	}
	return false;
}

/**
 * @param {object} params
 * @param {string} [params.batchPhase]
 */
export function resolveSalvageCommitRefusal({ batchPhase, worktreePath }) {
	if (String(batchPhase ?? "") === "merging") {
		return { refused: true, reason: "merge_in_progress" };
	}
	if (hasWorktreeIndexConflicts(worktreePath)) {
		return { refused: true, reason: "index_conflicts" };
	}
	return { refused: false, reason: null };
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskBranch
 * @param {string} params.taskId
 * @param {string[]} params.dirtyPaths
 * @param {string} [params.batchPhase]
 */
export function attemptScopedSalvageCommit({
	worktreePath,
	taskBranch,
	taskId,
	dirtyPaths,
	batchPhase,
}) {
	if (!Array.isArray(dirtyPaths) || dirtyPaths.length === 0) {
		return { committed: false, refused: true, reason: "no_scoped_dirty_paths" };
	}

	const refusal = resolveSalvageCommitRefusal({ worktreePath, batchPhase });
	if (refusal.refused) {
		return { committed: false, refused: true, reason: refusal.reason };
	}

	const iso = new Date().toISOString();
	const message = `wip(${taskId}): stall salvage ${iso}`;

	try {
		git(worktreePath, ["checkout", taskBranch]);
		git(worktreePath, ["add", "--", ...dirtyPaths]);
		git(worktreePath, ["commit", "-m", message]);
		const commitSha = git(worktreePath, ["rev-parse", "HEAD"]);
		return { committed: true, refused: false, reason: null, commitSha, message };
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		return { committed: false, refused: true, reason: "hook_or_commit_failed", error };
	}
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string[]} [params.fileScopePaths]
 * @param {string} params.taskFolder
 */
export function inspectLaneSalvage({ worktreePath, fileScopePaths = [], taskFolder }) {
	const dirtyPaths = resolveScopedDirtyPaths(worktreePath, fileScopePaths, taskFolder);
	const changedFileCount = dirtyPaths.length;
	const diffStat = readScopedDiffStat(worktreePath, dirtyPaths);
	const salvageable = changedFileCount > 0;
	const recommendedAction = salvageable
		? "retry_with_salvage_review"
		: "no_scoped_uncommitted_changes";

	return {
		dirtyPaths,
		diffStat,
		changedFileCount,
		salvageable,
		recommendedAction,
	};
}

/**
 * @param {object} params
 * @param {boolean} params.salvageable
 * @param {string} [params.taskId]
 */
export function resolveSalvageRetryCommand({ salvageable, taskId }) {
	if (salvageable && taskId) return `spine batch retry ${taskId}`;
	return null;
}

/**
 * @param {object} params
 */
export function writeSalvageEvidence({
	projectRoot,
	batchId,
	taskId,
	inspection,
	recommendedAction,
	classification,
	salvageCommit,
}) {
	const dir = evidenceDir(projectRoot, batchId);
	fs.mkdirSync(dir, { recursive: true });
	const rel = `evidence/salvage-${taskId}.json`;
	const abs = path.join(dir, `salvage-${taskId}.json`);
	const payload = {
		taskId,
		batchId,
		classification: classification ?? null,
		salvageable: inspection.salvageable,
		changedFileCount: inspection.changedFileCount,
		dirtyPaths: inspection.dirtyPaths,
		diffStat: inspection.diffStat,
		recommendedAction,
		retryCommand: resolveSalvageRetryCommand({
			salvageable: inspection.salvageable,
			taskId,
		}),
		salvageCommit: salvageCommit ?? null,
		recordedAt: new Date().toISOString(),
	};
	writeJsonAtomic(abs, payload);
	return rel;
}

/**
 * @param {object[]} events
 * @param {string|null|undefined} taskId
 */
export function findLatestSalvageInspection(events, taskId) {
	if (!taskId) return null;
	for (let i = events.length - 1; i >= 0; i -= 1) {
		const event = events[i];
		if (event.type !== "lane.salvage_inspection") continue;
		if (event.taskId !== taskId) continue;
		return event.payload && typeof event.payload === "object" ? event.payload : {};
	}
	return null;
}

/**
 * Run salvage inspection, journal, and evidence for a terminal worker failure without `.DONE`.
 *
 * @param {object} params
 */
export function recordTaskFailureSalvage({
	projectRoot,
	batchId,
	laneNumber,
	laneId,
	taskId,
	correlationId,
	worktreePath,
	fileScopePaths = [],
	taskFolder,
	workerResult,
	config,
	batchPhase,
	taskBranch,
}) {
	if (workerResult.doneFound) return {};
	if (workerResult.classification === "aborted") return {};

	const salvageConfig = resolveSalvageConfig(config);
	const inspection = inspectLaneSalvage({ worktreePath, fileScopePaths, taskFolder });
	const retryCommand = resolveSalvageRetryCommand({
		salvageable: inspection.salvageable,
		taskId,
	});
	const recommendedAction =
		retryCommand ??
		(inspection.salvageable ? "review_scoped_changes" : "spine status --diagnose");

	appendJournalEvent(projectRoot, batchId, "lane.salvage_inspection", {
		laneNumber,
		laneId,
		taskId,
		correlationId,
		classification: workerResult.classification ?? null,
		dirtyPaths: inspection.dirtyPaths,
		diffStat: inspection.diffStat,
		changedFileCount: inspection.changedFileCount,
		salvageable: inspection.salvageable,
		recommendedAction,
		retryCommand,
	});

	let salvageCommit = null;
	if (salvageConfig.autoCommitOnStall && inspection.salvageable && taskBranch) {
		const result = attemptScopedSalvageCommit({
			worktreePath,
			taskBranch,
			taskId,
			dirtyPaths: inspection.dirtyPaths,
			batchPhase,
		});
		salvageCommit = {
			committed: result.committed === true,
			refused: result.refused === true,
			reason: result.reason ?? null,
			commitSha: result.commitSha ?? null,
			message: result.message ?? null,
			error: result.error ?? null,
		};
		appendJournalEvent(projectRoot, batchId, "lane.salvage_commit", {
			laneNumber,
			laneId,
			taskId,
			correlationId,
			...salvageCommit,
			dirtyPaths: inspection.dirtyPaths,
		});
	}

	const salvageEvidenceRef = writeSalvageEvidence({
		projectRoot,
		batchId,
		taskId,
		inspection,
		recommendedAction,
		classification: workerResult.classification,
		salvageCommit,
	});

	return {
		salvageable: inspection.salvageable,
		changedFileCount: inspection.changedFileCount,
		salvageEvidenceRef,
		retryCommand,
		salvageCommitted: salvageCommit?.committed === true,
		salvageCommitSha: salvageCommit?.commitSha ?? null,
		salvageCommitRefused: salvageCommit?.refused === true,
		salvageCommitReason: salvageCommit?.reason ?? null,
	};
}
