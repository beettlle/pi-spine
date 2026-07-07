/**
 * Cross-process dashboard cache invalidation (batch dismiss / complete).
 * CLI lifecycle bumps a signal file; dashboard server consumes it on poll.
 */

import fs from "node:fs";
import path from "node:path";
import { clearJournalCache } from "../batch/journal.mjs";
import { clearLightReconcileCache } from "../batch/reconcile.mjs";

const SIGNAL_FILE = "dashboard-invalidate.json";

/** @type {number} */
let lastConsumedSeq = 0;

/**
 * @param {string} projectRoot
 */
export function dashboardInvalidateSignalPath(projectRoot) {
	return path.join(projectRoot, ".spine", "runtime", SIGNAL_FILE);
}

/**
 * Clear in-process reconcile/journal caches used by dashboard snapshots.
 */
export function clearDashboardProcessCaches() {
	clearLightReconcileCache();
	clearJournalCache();
}

/**
 * Bump invalidation signal after batch lifecycle clears active state.
 *
 * @param {string} projectRoot
 * @param {string} reason
 * @param {string|null} [batchId]
 */
export function bumpDashboardInvalidateSignal(projectRoot, reason, batchId = null) {
	const filePath = dashboardInvalidateSignalPath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	let seq = 1;
	if (fs.existsSync(filePath)) {
		try {
			const previous = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			seq = Number(previous.seq ?? 0) + 1;
		} catch {
			seq = 1;
		}
	}
	const payload = {
		at: Date.now(),
		seq,
		reason,
		batchId: batchId ?? null,
	};
	fs.writeFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf-8");
	clearDashboardProcessCaches();
	return filePath;
}

/**
 * Consume invalidation signal if newer than last consume in this process.
 *
 * @param {string} projectRoot
 * @returns {boolean} true when caches were cleared for a new signal
 */
export function consumeDashboardInvalidateSignal(projectRoot) {
	const filePath = dashboardInvalidateSignalPath(projectRoot);
	if (!fs.existsSync(filePath)) {
		return false;
	}

	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const payload = JSON.parse(raw);
		const seq = Number(payload.seq ?? 0);
		if (!Number.isFinite(seq) || seq <= lastConsumedSeq) {
			return false;
		}
		lastConsumedSeq = seq;
		clearDashboardProcessCaches();
		return true;
	} catch {
		return false;
	}
}

/** Reset consume cursor (test isolation). */
export function resetDashboardInvalidateConsumeCursor() {
	lastConsumedSeq = 0;
}
