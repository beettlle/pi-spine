// @ts-nocheck
/**
 * Archive-first batch abort (FR-BATCH-06, §18.6).
 */

import fs from "node:fs";
import path from "node:path";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { archiveBatchStatePath } from "./lifecycle.mjs";
import { reloadStateForTerminalWrite } from "./lifecycle-archive.mjs";
import { runPostReleaseCleanup } from "./lifecycle-cleanup.mjs";
import { appendJournalEvent, journalPath, readJournalEvents, readJournalTail } from "./journal.mjs";
import { loadBatchStateFile } from "./reconcile.mjs";
import { appendBatchHistoryEntry } from "./state.mjs";
import { withBatchStateLock } from "./batch-state-lock.mjs";
import { removeLaneWorktrees, maxLaneNumberFromBatchState } from "./worktree.mjs";
import { terminateLaneWorkers } from "./worker-host.mjs";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function abortSignalPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "abort-signal.json");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function readAbortSignal(projectRoot, batchId) {
	const signalPath = abortSignalPath(projectRoot, batchId);
	if (!fs.existsSync(signalPath)) return null;
	try {
		return JSON.parse(fs.readFileSync(signalPath, "utf-8"));
	} catch {
		return { hard: true, reason: null };
	}
}

/**
 * Write the abort signal atomically under the global batch-state lock
 * (SP-722 / #264) so a concurrent engine heartbeat never observes a
 * half-written signal.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} payload
 */
export function writeAbortSignal(projectRoot, batchId, payload) {
	return withBatchStateLock(projectRoot, () => {
		const signalPath = abortSignalPath(projectRoot, batchId);
		fs.mkdirSync(path.dirname(signalPath), { recursive: true });
		writeJsonAtomic(signalPath, payload);
		return signalPath;
	});
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {unknown} raw
 */
function writeBatchArchive(projectRoot, batchId, raw) {
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
 */
function clearActiveBatchState(batchStatePath) {
	if (batchStatePath && fs.existsSync(batchStatePath)) {
		fs.unlinkSync(batchStatePath);
	}
}

/**
 * @param {unknown[]} lanes
 * @param {boolean} hard
 */
function killLaneWorkers(lanes, hard) {
	terminateLaneWorkers(lanes, { hard });
}

/**
 * @param {object|null|undefined} config
 */
function shouldCleanupWorktreesOnHardAbort(config) {
	if (config?.worktrees?.cleanupOnHardAbort === false) return false;
	if (config?.lanes?.cleanupWorktreesOnHardAbort === false) return false;
	return true;
}

/**
 * @param {unknown} raw
 * @param {string|null} reason
 */
function buildAbortedSnapshot(raw, reason) {
	const snapshot = structuredClone(raw);
	const endedAt = Date.now();
	snapshot.phase = "aborted";
	snapshot.endedAt = endedAt;
	snapshot.updatedAt = endedAt;
	if (reason) snapshot.lastError = reason;

	for (const task of snapshot.tasks ?? []) {
		if (!task || typeof task !== "object") continue;
		const status = String(/** @type {{ status?: string }} */ (task).status ?? "");
		if (status === "running" || status === "pending") {
			/** @type {{ status: string, endedAt: number, exitReason: string }} */ (task).status = "aborted";
			/** @type {{ endedAt?: number }} */ (task).endedAt =
				/** @type {{ endedAt?: number }} */ (task).endedAt ?? endedAt;
			/** @type {{ exitReason?: string }} */ (task).exitReason = "aborted";
		}
	}

	for (const segment of snapshot.segments ?? []) {
		if (!segment || typeof segment !== "object") continue;
		const status = String(/** @type {{ status?: string }} */ (segment).status ?? "");
		if (status === "running" || status === "pending") {
			/** @type {{ status: string }} */ (segment).status = "aborted";
		}
	}

	return snapshot;
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {boolean} [ctx.hard]
 * @param {boolean} [ctx.dryRun]
 * @param {string|null} [ctx.reason]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.batchStatePath]
 */
export function abortBatch(ctx) {
	const { projectRoot, hard = false, reason = null, dryRun = false } = ctx;
	const loaded = loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path || !loaded.raw) {
		return {
			ok: false,
			exitCode: 1,
			headline: "No active batch to abort",
			suggestedCommand: "spine preflight",
			alternatives: ["spine status --diagnose"],
			batchId: null,
			dryRun,
		};
	}

	if (loaded.parseError) {
		return {
			ok: false,
			exitCode: 1,
			error: loaded.parseError,
			headline: `Cannot parse batch state: ${loaded.parseError}`,
			suggestedCommand: "spine status --diagnose",
			batchId: null,
			dryRun,
		};
	}

	const batchId = String(loaded.raw.batchId ?? loaded.raw.id ?? "").trim();
	if (!batchId) {
		return {
			ok: false,
			exitCode: 1,
			error: "batch_id_missing",
			headline: "Active batch state has no batchId",
			suggestedCommand: "spine status --diagnose",
			batchId: null,
			dryRun,
		};
	}

	if (ctx.batchId && ctx.batchId !== batchId) {
		return {
			ok: false,
			exitCode: 1,
			error: `Active batch is ${batchId}, not ${ctx.batchId}`,
			headline: `Batch ID mismatch — active batch is ${batchId}`,
			suggestedCommand: "spine status --diagnose",
			batchId,
			dryRun,
		};
	}

	const previewArchivePath = archiveBatchStatePath(projectRoot, batchId);

	// Dry-run previews abort without writing archive, journal, signal, or clearing live state.
	if (dryRun) {
		const abortCmd = hard ? "spine batch abort --hard" : "spine batch abort";
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			batchId,
			hard,
			reason: reason ?? null,
			diagnosis: "abort_preview",
			archivePath: previewArchivePath,
			headline: hard
				? `Would hard-abort and archive batch ${batchId}`
				: `Would abort and archive batch ${batchId}`,
			suggestedCommand: abortCmd,
			alternatives: ["spine status --diagnose"],
		};
	}

	// Terminal abort write section runs under the global batch-state lock
	// (SP-722 / #264; SP-796 / #302): abort signal, archive, journal event,
	// history entry, and clearing the active state must not interleave with a
	// concurrent engine save or a concurrent complete/resume writer. Worker
	// termination and worktree removal run after the lock is released.
	const inLock = withBatchStateLock(projectRoot, () => {
		// SP-792 / #301: archive the state as re-read inside the lock. Engine
		// progress saved between the pre-lock read and here must survive into
		// the archive; a changed or vanished state file fails closed instead.
		const { state: fresh, refusal } = reloadStateForTerminalWrite({
			projectRoot,
			batchStatePath: loaded.path,
			batchId,
			action: "abort",
		});
		if (refusal) return { refusal, snapshot: null, archivePath: null };

		const snapshot = buildAbortedSnapshot(fresh.raw, reason);
		writeAbortSignal(projectRoot, batchId, {
			hard,
			reason: reason ?? null,
			requestedAt: new Date().toISOString(),
		});

		const archivePath = writeBatchArchive(projectRoot, batchId, snapshot);

		const eventsBefore = readJournalEvents(projectRoot, batchId);
		const journalTail = readJournalTail(eventsBefore);
		appendJournalEvent(projectRoot, batchId, "batch.aborted", {
			reason: reason ?? null,
			hard,
			archivePath: path.relative(projectRoot, archivePath),
			journalEventsBeforeAbort: eventsBefore.length,
			journalTailEventTypes: journalTail.map((event) => event.type),
		});

		const journalFile = journalPath(projectRoot, batchId);
		if (!fs.existsSync(journalFile)) {
			return {
				refusal: {
					ok: false,
					exitCode: 1,
					error: "journal_missing_after_abort",
					headline: "Abort archived state but journal file is missing",
					suggestedCommand: "spine status --diagnose",
					batchId,
				},
				snapshot: null,
				archivePath: null,
			};
		}

		appendBatchHistoryEntry(projectRoot, {
			batchId,
			action: "aborted",
			endedAt: snapshot.endedAt,
			hard,
			reason: reason ?? null,
			archivePath: path.relative(projectRoot, archivePath),
		});

		clearActiveBatchState(fresh.path);

		return { refusal: null, snapshot, archivePath };
	});

	// Cleanup runs only when the in-lock section succeeded (journaled
	// `batch.aborted`); a refusal means nothing was archived for this batch.
	if (inLock.refusal) return inLock.refusal;

	// SP-796 / #302: worker kill and worktree removal run after the lock is
	// released, so they no longer block concurrent engine saves. Failures
	// here are reported as cleanupWarnings + `batch.cleanup_failed` instead
	// of thrown, because the state was already archived and journaled aborted.
	const cleanupSteps = [];
	if (hard) {
		cleanupSteps.push({
			step: "kill_lane_workers",
			run: () => {
				killLaneWorkers(inLock.snapshot.lanes, true);
			},
		});
		cleanupSteps.push({
			step: "remove_worktrees",
			run: () => {
				const config = loadSpineConfig(projectRoot).config ?? {};
				if (!shouldCleanupWorktreesOnHardAbort(config)) return;
				const laneCount = maxLaneNumberFromBatchState(inLock.snapshot);
				removeLaneWorktrees(projectRoot, batchId, laneCount);
				appendJournalEvent(projectRoot, batchId, "batch.worktrees_cleaned", {
					batchId,
					laneCount,
					reason: "hard_abort",
				});
			},
		});
	}
	const cleanupWarnings = runPostReleaseCleanup({ projectRoot, batchId, steps: cleanupSteps });

	return {
		ok: true,
		exitCode: 0,
		batchId,
		diagnosis: "aborted",
		hard,
		headline: hard
			? `Batch ${batchId} hard-aborted and archived`
			: `Batch ${batchId} aborted and archived`,
		suggestedCommand: "spine preflight",
		alternatives: ["spine batch dismiss", "spine status --diagnose"],
		archivePath: inLock.archivePath,
		cleanupWarnings,
	};
}
