/**
 * Worker gate request — v2.2 permanent not_supported (FR-SHIP-13 / SP-241).
 * Integrate gates are operator-managed and open automatically at batch completion.
 * Manual and conflict gate kinds have no worker-initiated open path in v2.2.
 * Operators approve integrate gates from the host: `spine gate approve`.
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

	// v2.2: no worker-initiated gate open for manual/conflict kinds; direct operators to host CLI.
	return {
		ok: false,
		notSupported: true,
		limitation: "manual-gate-deferred",
		reason:
			reason ??
			"Worker gate requests are permanently not_supported in v2.2; operator runs spine gate commands from the host.",
		headline: "Worker gate requests permanently not supported (v2.2)",
		suggestedCommand: "spine gate approve",
		alternatives: ["spine gate status", "/spine-gate"],
		gate: existing ?? null,
	};
}
