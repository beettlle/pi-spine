/**
 * Integrate gate FSM and persistence (PRD §12, FR-GATE, FR-INT-02).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { collectEvidenceBundle } from "./evidence.mjs";
import { appendJournalEvent } from "./journal.mjs";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function gateRecordPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "gate.json");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {object|null}
 */
export function loadGateRecord(projectRoot, batchId) {
	const filePath = gateRecordPath(projectRoot, batchId);
	if (!fs.existsSync(filePath)) return null;

	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * @param {string} projectRoot
 * @param {object} gate
 */
export function saveGateRecord(projectRoot, gate) {
	const filePath = gateRecordPath(projectRoot, gate.batchId);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(gate, null, 2)}\n`, "utf-8");

	const fd = fs.openSync(filePath, "r");
	try {
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}
}

/**
 * @param {object} gate
 */
export function formatGateSummary(gate) {
	const status = String(gate.status ?? "unknown");
	const kind = String(gate.kind ?? "integrate");
	const evidenceCount = Array.isArray(gate.evidenceRefs) ? gate.evidenceRefs.length : 0;
	return `${kind} gate ${status} (${evidenceCount} evidence artifact(s))`;
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {import("../../bin/spine-config.mjs").SpineConfig|null} [ctx.config]
 */
export function openIntegrateGate(ctx) {
	const { projectRoot, batchId, batchState = null, config = null } = ctx;
	const existing = loadGateRecord(projectRoot, batchId);
	if (existing) {
		return { gate: existing, opened: false, evidenceRefs: existing.evidenceRefs ?? [] };
	}

	const evidence = collectEvidenceBundle({ projectRoot, batchId, batchState, config });
	const gate = {
		gateId: crypto.randomUUID(),
		batchId,
		kind: "integrate",
		status: "pending",
		openedAt: new Date().toISOString(),
		evidenceRefs: evidence.evidenceRefs,
		summary: formatGateSummary({ kind: "integrate", status: "pending", evidenceRefs: evidence.evidenceRefs }),
	};

	saveGateRecord(projectRoot, gate);
	appendJournalEvent(projectRoot, batchId, "gate.opened", {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
		evidenceRefs: gate.evidenceRefs,
	});

	return { gate, opened: true, evidenceRefs: evidence.evidenceRefs };
}

/**
 * Auto-open integrate gate when batch reaches terminal success (AC-4.1).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object} ctx.batchState
 */
export function openIntegrateGateAfterBatchComplete(ctx) {
	const { projectRoot, batchId, batchState } = ctx;
	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? null;

	if (batchState?.phase !== "completed") {
		return { skipped: true, reason: "batch_not_completed" };
	}

	if (!batchState?.orchBranch) {
		return { skipped: true, reason: "no_orch_branch" };
	}

	return {
		skipped: false,
		...openIntegrateGate({ projectRoot, batchId, batchState, config }),
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 */
export function approveIntegrateGate(ctx) {
	const { projectRoot, batchId } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return {
			ok: false,
			exitCode: 1,
			error: "No integrate gate found for this batch",
			headline: "Cannot approve — gate not opened",
			suggestedCommand: "spine status --diagnose",
		};
	}

	if (gate.status === "approved") {
		return { ok: true, exitCode: 0, gate, headline: "Integrate gate already approved", alreadyDecided: true };
	}

	if (gate.status === "rejected") {
		return {
			ok: false,
			exitCode: 1,
			error: "Gate was rejected — reopen batch evidence or start a new gate cycle",
			headline: "Cannot approve a rejected gate",
			suggestedCommand: "spine gate status",
			gate,
		};
	}

	gate.status = "approved";
	gate.decidedAt = new Date().toISOString();
	gate.decidedBy = "human";
	saveGateRecord(projectRoot, gate);

	appendJournalEvent(projectRoot, batchId, "gate.approved", {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
	});

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: "Integrate gate approved",
		suggestedCommand: "spine integrate",
		alternatives: ["/spine-integrate"],
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {string} [ctx.reason]
 */
export function rejectIntegrateGate(ctx) {
	const { projectRoot, batchId, reason } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return {
			ok: false,
			exitCode: 1,
			error: "No integrate gate found for this batch",
			headline: "Cannot reject — gate not opened",
			suggestedCommand: "spine status --diagnose",
		};
	}

	if (gate.status === "rejected") {
		return { ok: true, exitCode: 0, gate, headline: "Integrate gate already rejected", alreadyDecided: true };
	}

	if (gate.status === "approved") {
		return {
			ok: false,
			exitCode: 1,
			error: "Gate already approved",
			headline: "Cannot reject an approved gate",
			suggestedCommand: "spine integrate",
			gate,
		};
	}

	gate.status = "rejected";
	gate.decidedAt = new Date().toISOString();
	gate.decidedBy = "human";
	if (reason) gate.rejectionReason = reason;
	saveGateRecord(projectRoot, gate);

	appendJournalEvent(projectRoot, batchId, "gate.rejected", {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
		reason: reason ?? null,
	});

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: "Integrate gate rejected",
		suggestedCommand: "spine status --diagnose",
		alternatives: ["/spine-gate status"],
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 */
export function getIntegrateGateStatus(ctx) {
	const { projectRoot, batchId } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return {
			ok: true,
			exitCode: 0,
			gate: null,
			headline: "No integrate gate on record",
			suggestedCommand: "spine status --diagnose",
		};
	}

	const commands =
		gate.status === "pending"
			? { suggestedCommand: "spine gate approve", alternatives: ["spine gate reject", "/spine-gate approve"] }
			: gate.status === "approved"
				? { suggestedCommand: "spine integrate", alternatives: ["/spine-integrate"] }
				: { suggestedCommand: "spine status --diagnose", alternatives: [] };

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: formatGateSummary(gate),
		...commands,
	};
}

/**
 * Fail-closed integrate gate check (§12.4).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {import("../../bin/spine-config.mjs").SpineConfig|null} [ctx.config]
 * @param {boolean} [ctx.forceIntegrate]
 * @param {boolean} [ctx.dryRun]
 */
export function checkIntegrateGate(ctx) {
	const { projectRoot, batchId, forceIntegrate = false, dryRun = false } = ctx;
	const config = ctx.config ?? loadSpineConfig(projectRoot).config ?? null;
	const requireGate = config?.gates?.requireBeforeIntegrate === true;

	if (!requireGate) {
		return { ok: true, required: false };
	}

	if (forceIntegrate) {
		if (process.env.SPINE_ALLOW_FORCE !== "1") {
			return {
				ok: false,
				required: true,
				exitCode: 2,
				failureClass: "GateBlocked",
				error: "Force integrate requires SPINE_ALLOW_FORCE=1",
				headline: "Force integrate blocked — set SPINE_ALLOW_FORCE=1 to bypass gate",
				suggestedCommand: "spine gate approve",
			};
		}

		if (!dryRun) {
			appendJournalEvent(projectRoot, batchId, "integrate.force_bypass", {
				env: "SPINE_ALLOW_FORCE=1",
				gateRequired: true,
			});
		}

		return { ok: true, required: true, forced: true };
	}

	const gate = loadGateRecord(projectRoot, batchId);
	if (!gate) {
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error: "Integrate gate not opened — approve evidence before merging",
			headline: "Integrate blocked — no gate record (run batch to completion or spine gate status)",
			suggestedCommand: "spine gate status",
			alternatives: ["/spine-gate"],
		};
	}

	if (gate.status === "approved") {
		return { ok: true, required: true, gate };
	}

	if (gate.status === "rejected") {
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error: gate.rejectionReason ?? "Integrate gate was rejected",
			headline: "Integrate blocked — gate rejected",
			suggestedCommand: "spine gate status",
			gate,
			alternatives: ["/spine-gate status"],
		};
	}

	return {
		ok: false,
		required: true,
		exitCode: 2,
		failureClass: "GateBlocked",
		error: "Integrate gate pending human approval",
		headline: "Integrate blocked — gate pending approval",
		suggestedCommand: "spine gate approve",
		gate,
		alternatives: ["/spine-gate approve", "spine gate reject"],
	};
}
