/**
 * Worker gate request — minimal v1.1 (PRD §14.5, §12).
 * Integrate gates are operator-managed and open automatically at batch completion.
 * Manual gate open/refresh is deferred; workers receive structured not_supported.
 */

import { loadGateRecord } from "../batch/gate.mjs";

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {string} [params.reason]
 */
export function requestWorkerGate({ projectRoot, batchId, reason }) {
	if (!projectRoot || !batchId) {
		return {
			ok: false,
			error: "batch context required (projectRoot and batchId)",
			suggestedCommand: "spine status --diagnose",
		};
	}

	const existing = loadGateRecord(projectRoot, batchId);
	if (existing?.kind === "integrate") {
		return {
			ok: false,
			notSupported: true,
			limitation: "integrate-only",
			reason:
				reason ??
				"Integrate gate is operator-managed and opens automatically at batch completion.",
			headline: "Worker gate requests not supported for integrate gates",
			suggestedCommand: "spine gate status",
			alternatives: ["spine gate approve", "/spine-gate"],
			gate: existing,
		};
	}

	// v1.1: manual gate open via gate record APIs is not wired; direct operators to CLI.
	return {
		ok: false,
		notSupported: true,
		limitation: "manual-gate-deferred",
		reason:
			reason ??
			"Manual gate open from worker tools is not supported in v1.1; use operator spine gate commands.",
		headline: "Worker manual gate requests not supported",
		suggestedCommand: "spine gate",
		alternatives: ["/spine-gate"],
		gate: existing ?? null,
	};
}
