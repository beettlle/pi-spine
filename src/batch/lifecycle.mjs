/**
 * Batch lifecycle: dismiss, complete, archive-first (FR-BATCH-15/16, §18.6).
 */

import fs from "node:fs";
import path from "node:path";
import { buildDiagnosisOutput } from "./diagnosis.mjs";
import { assertOrchIntegratable } from "./integrate.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { recordBatchTerminalMetric } from "./metrics.mjs";
import { writeBatchPostMortem } from "./postmortem.mjs";
import {
	appendBatchHistoryEntry,
	clearBatchEnginePid,
	saveSpineBatchState,
} from "./state.mjs";
import { loadBatchStateFile, parseBatchState, reconcileBatch } from "./reconcile.mjs";
import {
	clearActiveBatchStateIfMatches,
} from "./batch-state-io.mjs";
import { terminateLaneWorkers } from "./worker-host.mjs";
import { removeLaneWorktrees } from "./worktree.mjs";
import { terminateSupervisorIfRunning } from "./supervisor-spawn.mjs";

const DISMISS_ALLOWED = new Set(["limbo_stale", "completed_manual", "aborted"]);

export { recordBatchBaseSnapshot as recordBatchBaseSnapshotOnStart } from "./integrate-worktree.mjs";

/**
 * Terminal merge-blocked state when the engine exits after a wave merge failure (GitHub #38).
 * Clears stale enginePid so status does not imply an in-progress merge.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {string} params.error
 * @param {number|null} [params.waveIndex]
 * @param {number|null} [params.laneNumber]
 * @param {string|null} [params.failureClass]
 * @param {string[]} [params.failedTaskIds]
 * @param {string[]} [params.pendingTaskIds]
 * @param {string} [params.reason]
 */
export function recordMergeBlocked({
	projectRoot,
	state,
	batchId,
	error,
	waveIndex = null,
	laneNumber = null,
	failureClass = null,
	failedTaskIds = null,
	pendingTaskIds = null,
	reason = "merge_failed",
}) {
	const fromPhase = String(state.phase ?? "running");
	const message = String(error ?? "merge blocked").slice(0, 500);
	state.endedAt = Date.now();
	state.lastError = message;
	state.phase = "merge_blocked";
	clearBatchEnginePid(state);

	appendJournalEvent(projectRoot, batchId, "batch.merge_blocked", {
		fromPhase,
		reason,
		waveIndex,
		laneNumber,
		failureClass,
		failedTaskIds,
		pendingTaskIds,
		error: message,
	});

	saveSpineBatchState(projectRoot, state);

	return {
		phase: "merge_blocked",
		fromPhase,
		lastError: message,
	};
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function archiveBatchStatePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "archive", "batch-state.json");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {unknown} raw
 */
function archiveBatchState(projectRoot, batchId, raw) {
	const archivePath = archiveBatchStatePath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(archivePath), { recursive: true });
	fs.writeFileSync(archivePath, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");

	const fd = fs.openSync(archivePath, "r");
	try {
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}

	return archivePath;
}

/**
 * @param {string|null} batchStatePath
 * @param {string} batchId
 */
function clearCompletedBatchState(batchStatePath, batchId) {
	clearActiveBatchStateIfMatches(batchStatePath, batchId);
}

/**
 * @param {unknown} raw
 */
function maxLaneNumberFromBatchState(raw) {
	const lanes = /** @type {{ lanes?: unknown }} */ (raw)?.lanes;
	if (!Array.isArray(lanes) || lanes.length === 0) return 1;
	let max = 1;
	for (const lane of lanes) {
		if (!lane || typeof lane !== "object") continue;
		const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (lane).laneNumber);
		if (Number.isFinite(laneNumber) && laneNumber > max) {
			max = laneNumber;
		}
	}
	return max;
}

/**
 * @param {object|null|undefined} config
 */
function shouldCleanupWorktreesOnComplete(config) {
	if (config?.lanes?.cleanupWorktreesOnComplete === false) return false;
	return true;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {unknown} params.batchState
 * @param {object} params.config
 */
function cleanupBatchLaneWorktrees({ projectRoot, batchId, batchState, config }) {
	if (!shouldCleanupWorktreesOnComplete(config)) return;
	const laneCount = maxLaneNumberFromBatchState(batchState);
	removeLaneWorktrees(projectRoot, batchId, laneCount);
	appendJournalEvent(projectRoot, batchId, "batch.worktrees_cleaned", {
		batchId,
		laneCount,
	});
}

/**
 * @param {object} signals
 */
function hasLiveLanes(signals) {
	if (!signals) return false;
	if (signals.hasRunningTasks || signals.hasPendingTasks) return true;
	const lanes = signals.lanes;
	return (
		Array.isArray(lanes) &&
		lanes.some((lane) => {
			const status = String(lane?.status ?? "").toLowerCase();
			return status === "running" || status === "active";
		})
	);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} [ctx.reason]
 * @param {boolean} [ctx.force]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.batchStatePath]
 */
export function dismissBatch(ctx) {
	const { projectRoot, reason, force = false } = ctx;
	const loaded = loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path || !loaded.raw) {
		return {
			ok: false,
			exitCode: 1,
			headline: "No active batch to dismiss",
			suggestedCommand: "spine preflight",
			alternatives: ["spine status --diagnose"],
			diagnosis: null,
			batchId: null,
		};
	}

	if (loaded.parseError) {
		return {
			ok: false,
			exitCode: 1,
			error: loaded.parseError,
			headline: `Cannot parse batch state: ${loaded.parseError}`,
			suggestedCommand: "spine status --diagnose",
			diagnosis: "failed",
			batchId: null,
		};
	}

	const reconciliation = reconcileBatch({
		projectRoot,
		batchStatePath: loaded.path,
		batchState: loaded.raw,
		verbose: true,
	});

	const diagnosis = reconciliation.diagnosis;
	const batchId = reconciliation.batchId ?? String(loaded.raw.batchId ?? loaded.raw.id ?? "");

	if (ctx.batchId && batchId && ctx.batchId !== batchId) {
		return {
			ok: false,
			exitCode: 1,
			error: `Active batch is ${batchId}, not ${ctx.batchId}`,
			headline: `Batch ID mismatch — active batch is ${batchId}`,
			suggestedCommand: "spine status --diagnose",
			diagnosis,
			batchId,
		};
	}

	if (diagnosis === "running" && hasLiveLanes(reconciliation.signals) && !force) {
		const output = buildDiagnosisOutput(diagnosis, {
			batchId,
			phase: reconciliation.phase,
		});
		return {
			ok: false,
			exitCode: 1,
			error: "Batch is still running with live lanes",
			...output,
			headline: `${output.headline} — use --force to dismiss anyway`,
			suggestedCommand: "spine batch dismiss --force",
			alternatives: ["/spine-status --diagnose", ...output.alternatives],
			batchId,
		};
	}

	if (diagnosis && !DISMISS_ALLOWED.has(diagnosis) && !force) {
		const output = buildDiagnosisOutput(diagnosis, {
			batchId,
			phase: reconciliation.phase,
			failedTaskId: reconciliation.signals?.failedTaskId ?? null,
		});
		return {
			ok: false,
			exitCode: 1,
			error: `Dismiss not allowed for diagnosis: ${diagnosis}`,
			...output,
			headline: `${output.headline} — dismiss refused (use --force to override)`,
			suggestedCommand: output.suggestedCommand,
			batchId,
		};
	}

	terminateSupervisorIfRunning(projectRoot, batchId, "batch_dismiss");

	const terminatedWorkers = terminateLaneWorkers(loaded.raw.lanes, { hard: true });
	for (const entry of terminatedWorkers) {
		appendJournalEvent(projectRoot, batchId, "lane.worker_terminated", {
			laneNumber: entry.laneNumber,
			workerPid: entry.workerPid,
			signal: entry.signal,
			reason: "batch_dismiss",
			force,
		});
	}
	const archivePath = archiveBatchState(projectRoot, batchId, loaded.raw);
	const postMortemPath = writeBatchPostMortem({
		projectRoot,
		batchState: loaded.raw,
		reconciliation,
	});
	const endedAt = Date.now();
	appendBatchHistoryEntry(projectRoot, {
		batchId,
		action: "dismissed",
		endedAt,
		diagnosis,
		reason: reason ?? null,
		archivePath: path.relative(projectRoot, archivePath),
		postMortemPath,
	});
	appendJournalEvent(projectRoot, batchId, "batch.dismissed", {
		diagnosis,
		reason: reason ?? null,
		archivePath: path.relative(projectRoot, archivePath),
	});
	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	recordBatchTerminalMetric({
		projectRoot,
		batchId,
		batchState: { ...loaded.raw, endedAt },
		diagnosis: diagnosis ?? "dismissed",
		config,
	});
	cleanupBatchLaneWorktrees({
		projectRoot,
		batchId,
		batchState: loaded.raw,
		config,
	});
	clearCompletedBatchState(loaded.path, batchId);

	return {
		ok: true,
		exitCode: 0,
		batchId,
		diagnosis,
		headline: `Batch ${batchId} dismissed and archived`,
		suggestedCommand: "spine preflight",
		alternatives: ["spine plan all"],
		archivePath,
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {boolean} [ctx.detectManualMerge]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.batchStatePath]
 */
export function completeBatch(ctx) {
	const { projectRoot, detectManualMerge = false } = ctx;
	const loaded = loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path || !loaded.raw) {
		return {
			ok: false,
			exitCode: 1,
			headline: "No active batch to complete",
			suggestedCommand: "spine preflight",
			diagnosis: null,
			batchId: null,
		};
	}

	if (loaded.parseError) {
		return {
			ok: false,
			exitCode: 1,
			error: loaded.parseError,
			headline: `Cannot parse batch state: ${loaded.parseError}`,
			suggestedCommand: "spine status --diagnose",
			diagnosis: "failed",
			batchId: null,
		};
	}

	const reconciliation = reconcileBatch({
		projectRoot,
		batchStatePath: loaded.path,
		batchState: loaded.raw,
		verbose: true,
	});

	const diagnosis = reconciliation.diagnosis;
	const batchId = reconciliation.batchId ?? String(loaded.raw.batchId ?? loaded.raw.id ?? "");
	const signals = reconciliation.signals ?? {};
	const mergeSatisfied = !signals.mergeResultsEmpty || Boolean(signals.git?.orchMergedToBase);
	const manualMergeOk =
		detectManualMerge &&
		(diagnosis === "completed_manual" || Boolean(signals.git?.orchMergedToBase));
	const allSuccess = Boolean(signals.allTasksTerminalSuccess);

	if (ctx.batchId && batchId && ctx.batchId !== batchId) {
		return {
			ok: false,
			exitCode: 1,
			error: `Active batch is ${batchId}, not ${ctx.batchId}`,
			headline: `Batch ID mismatch — active batch is ${batchId}`,
			suggestedCommand: "spine status --diagnose",
			diagnosis,
			batchId,
		};
	}

	const allowed =
		diagnosis === "completed" ||
		diagnosis === "completed_manual" ||
		(allSuccess && (mergeSatisfied || manualMergeOk));

	if (!allowed) {
		const output = buildDiagnosisOutput(diagnosis ?? "paused", {
			batchId,
			phase: reconciliation.phase,
			gitMerged: Boolean(signals.git?.orchMergedToBase),
		});
		return {
			ok: false,
			exitCode: 1,
			error: "Batch is not ready to complete",
			...output,
			headline: `${output.headline} — complete refused`,
			suggestedCommand: detectManualMerge
				? "spine status --diagnose"
				: "spine batch complete --detect-manual-merge",
			alternatives: ["spine batch dismiss", ...(output.alternatives ?? [])],
			batchId,
		};
	}

	const batch = parseBatchState(loaded.raw, loaded.path ?? "");
	const integratable = assertOrchIntegratable(projectRoot, {
		baseBranch: batch?.baseBranch ?? String(loaded.raw.baseBranch ?? "main"),
		orchBranch: batch?.orchBranch ?? loaded.raw.orchBranch ?? null,
		mergeResultsEmpty: signals.mergeResultsEmpty,
		orchMergedToBase: Boolean(signals.git?.orchMergedToBase),
	});

	if (!integratable.ok && !manualMergeOk) {
		const output = buildDiagnosisOutput(
			integratable.failureClass === "NeedsIntegrate" ? "needs_integrate" : (diagnosis ?? "paused"),
			{
				batchId,
				phase: reconciliation.phase,
				gitMerged: false,
			},
		);
		return {
			ok: false,
			exitCode: 1,
			error: integratable.error,
			failureClass: integratable.failureClass,
			...output,
			headline: `${integratable.error} — complete refused`,
			suggestedCommand: integratable.suggestedCommand ?? output.suggestedCommand,
			alternatives: output.alternatives,
			batchId,
		};
	}

	terminateSupervisorIfRunning(projectRoot, batchId, "batch_complete");

	const archivePath = archiveBatchState(projectRoot, batchId, loaded.raw);
	const postMortemPath = writeBatchPostMortem({
		projectRoot,
		batchState: loaded.raw,
		reconciliation,
	});
	const endedAt = Date.now();
	appendBatchHistoryEntry(projectRoot, {
		batchId,
		action: "completed",
		endedAt,
		diagnosis: "completed",
		detectManualMerge,
		archivePath: path.relative(projectRoot, archivePath),
		postMortemPath,
	});
	appendJournalEvent(projectRoot, batchId, "batch.completed", {
		detectManualMerge,
		archivePath: path.relative(projectRoot, archivePath),
		lifecycle: "complete",
	});
	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	recordBatchTerminalMetric({
		projectRoot,
		batchId,
		batchState: { ...loaded.raw, endedAt },
		diagnosis: "completed",
		config,
	});
	cleanupBatchLaneWorktrees({
		projectRoot,
		batchId,
		batchState: loaded.raw,
		config,
	});
	clearCompletedBatchState(loaded.path, batchId);

	return {
		ok: true,
		exitCode: 0,
		batchId,
		diagnosis: "completed",
		headline: `Batch ${batchId} completed and archived`,
		suggestedCommand: "spine preflight",
		alternatives: ["spine plan all"],
		archivePath,
	};
}
