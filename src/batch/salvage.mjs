/**
 * FR-STALL-03A: read-only salvage inspection when a lane worker fails without `.DONE`.
 *
 * Scope (intentionally narrow): paths listed in the task File Scope plus everything
 * under the task folder in the lane worktree — not the full worktree (see brief OQ #3).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveScopedDirtyPaths } from "./heartbeat.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { evidenceDir } from "./evidence.mjs";

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
		recordedAt: new Date().toISOString(),
	};
	fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
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
}) {
	if (workerResult.doneFound) return {};
	if (workerResult.classification === "aborted") return {};

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

	const salvageEvidenceRef = writeSalvageEvidence({
		projectRoot,
		batchId,
		taskId,
		inspection,
		recommendedAction,
		classification: workerResult.classification,
	});

	return {
		salvageable: inspection.salvageable,
		changedFileCount: inspection.changedFileCount,
		salvageEvidenceRef,
		retryCommand,
	};
}
