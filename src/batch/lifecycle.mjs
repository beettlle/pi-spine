/**
 * Batch lifecycle: dismiss, complete, archive-first (FR-BATCH-15/16, §18.6).
 */

import fs from "node:fs";
import path from "node:path";
import { buildDiagnosisOutput } from "./diagnosis.mjs";
import { loadBatchStateFile, reconcileBatch } from "./reconcile.mjs";

const DISMISS_ALLOWED = new Set(["limbo_stale", "completed_manual", "aborted"]);

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
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} entry
 */
function appendJournalEvent(projectRoot, batchId, entry) {
	const journalPath = path.join(projectRoot, ".spine", "runtime", batchId, "journal", "events.jsonl");
	fs.mkdirSync(path.dirname(journalPath), { recursive: true });
	fs.appendFileSync(journalPath, `${JSON.stringify(entry)}\n`, "utf-8");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} summary
 */
function writeBatchHistory(projectRoot, batchId, summary) {
	const historyPath = path.join(projectRoot, ".spine", "runtime", batchId, "history.json");
	fs.mkdirSync(path.dirname(historyPath), { recursive: true });
	fs.writeFileSync(historyPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
	return historyPath;
}

/**
 * @param {string|null} batchStatePath
 */
function clearActiveBatchState(batchStatePath) {
	if (batchStatePath && fs.existsSync(batchStatePath)) {
		fs.unlinkSync(batchStatePath);
	}
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

	const archivePath = archiveBatchState(projectRoot, batchId, loaded.raw);
	const endedAt = Date.now();
	writeBatchHistory(projectRoot, batchId, {
		batchId,
		action: "dismissed",
		endedAt,
		diagnosis,
		reason: reason ?? null,
		archivePath: path.relative(projectRoot, archivePath),
	});
	appendJournalEvent(projectRoot, batchId, {
		type: "batch.dismissed",
		batchId,
		at: endedAt,
		diagnosis,
		reason: reason ?? null,
	});
	clearActiveBatchState(loaded.path);

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

	const archivePath = archiveBatchState(projectRoot, batchId, loaded.raw);
	const endedAt = Date.now();
	writeBatchHistory(projectRoot, batchId, {
		batchId,
		action: "completed",
		endedAt,
		diagnosis: "completed",
		detectManualMerge,
		archivePath: path.relative(projectRoot, archivePath),
	});
	appendJournalEvent(projectRoot, batchId, {
		type: "batch.completed",
		batchId,
		at: endedAt,
		detectManualMerge,
	});
	clearActiveBatchState(loaded.path);

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
