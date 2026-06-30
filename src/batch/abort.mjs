/**
 * Archive-first batch abort (FR-BATCH-06, §18.6).
 */

import fs from "node:fs";
import path from "node:path";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { archiveBatchStatePath } from "./lifecycle.mjs";
import { appendJournalEvent, journalPath, readJournalEvents, readJournalTail } from "./journal.mjs";
import { loadBatchStateFile } from "./reconcile.mjs";
import { appendBatchHistoryEntry } from "./state.mjs";
import { removeLaneWorktree } from "./worktree.mjs";
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
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} payload
 */
export function writeAbortSignal(projectRoot, batchId, payload) {
	const signalPath = abortSignalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(signalPath), { recursive: true });
	fs.writeFileSync(signalPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
	return signalPath;
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
 * @param {string|null} [ctx.reason]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.batchStatePath]
 */
export function abortBatch(ctx) {
	const { projectRoot, hard = false, reason = null } = ctx;
	const loaded = loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path || !loaded.raw) {
		return {
			ok: false,
			exitCode: 1,
			headline: "No active batch to abort",
			suggestedCommand: "spine preflight",
			alternatives: ["spine status --diagnose"],
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
			batchId: null,
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
		};
	}

	const snapshot = buildAbortedSnapshot(loaded.raw, reason);
	writeAbortSignal(projectRoot, batchId, {
		hard,
		reason: reason ?? null,
		requestedAt: new Date().toISOString(),
	});

	if (hard) {
		killLaneWorkers(snapshot.lanes, true);
	}

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
			ok: false,
			exitCode: 1,
			error: "journal_missing_after_abort",
			headline: "Abort archived state but journal file is missing",
			suggestedCommand: "spine status --diagnose",
			batchId,
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

	if (hard) {
		const configResult = loadSpineConfig(projectRoot);
		if (shouldCleanupWorktreesOnHardAbort(configResult.config ?? {})) {
			for (const lane of snapshot.lanes ?? []) {
				const laneNumber = Number(
					lane && typeof lane === "object"
						? /** @type {{ laneNumber?: number }} */ (lane).laneNumber
						: 1,
				);
				try {
					removeLaneWorktree(projectRoot, batchId, laneNumber || 1);
				} catch {
					// best-effort cleanup
				}
			}
		}
	}

	clearActiveBatchState(loaded.path);

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
		archivePath,
	};
}
