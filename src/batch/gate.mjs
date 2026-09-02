// @ts-nocheck
/**
 * Integrate gate FSM and persistence (PRD §12, FR-GATE, FR-INT-02).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { resolveGatePostureConfig } from "../config/gate-posture-config.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import {
	collectCoreEvidenceBundle,
	collectExtendedEvidenceBundle,
	collectEvidenceBundle,
	finalizeEvidenceBundleComplete,
} from "./gate-evidence-collect.mjs";
import {
	evidenceCompletePath,
	evidenceDir,
	formatGateSummary,
	gateRecordPath,
	loadGateRecord,
} from "./gate-evidence-read.mjs";
import { loadBatchStateFile } from "./batch-state-io.mjs";
import { makeBlocker } from "./blocker-codes.mjs";
import { GATE_CATEGORIES } from "./gate-posture-defaults.mjs";
import { resolveGateTargetRevision, validateGateTargetRevision } from "./gate-revision.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { reconcileBatch } from "./reconcile.mjs";

export {
	approveIntegrateGate,
	hasExplicitCategoryPostureOptIn,
	maybeAutoApproveIntegrateGate,
	rejectIntegrateGate,
} from "./gate-posture-approve.mjs";

/** @typedef {import("./gate-posture-defaults.mjs").GateCategory} GateCategory */

/**
 * Default category stamped on integrate gates (SP-630 / FR-REL250-08 / #123).
 * Explore decision: execute mapped to locked posture until config opts in (SP-632).
 */
export const DEFAULT_INTEGRATE_GATE_CATEGORY = /** @type {GateCategory} */ ("execute");

const CATEGORY_SET = new Set(/** @type {string[]} */ ([...GATE_CATEGORIES]));

/**
 * Resolve integrate gate category from config overlay or fail-closed default.
 * Valid `gates.integrateCategory` wins; unknown/missing → execute.
 * Consults posture config so stamp stays aligned with defaults/config mapping.
 *
 * @param {unknown} config
 * @returns {GateCategory}
 */
export function resolveIntegrateGateCategory(config) {
	const postureConfig = resolveGatePostureConfig(config);
	/** @type {GateCategory} */
	let category = DEFAULT_INTEGRATE_GATE_CATEGORY;

	if (config && typeof config === "object" && !Array.isArray(config)) {
		const gates = /** @type {{ integrateCategory?: unknown }} */ (config).gates;
		if (gates && typeof gates === "object" && !Array.isArray(gates)) {
			const raw = /** @type {{ integrateCategory?: unknown }} */ (gates).integrateCategory;
			if (typeof raw === "string" && CATEGORY_SET.has(raw)) {
				category = /** @type {GateCategory} */ (raw);
			}
		}
	}

	if (!(category in postureConfig.categories)) {
		return DEFAULT_INTEGRATE_GATE_CATEGORY;
	}
	return category;
}

export {
	collectCoreEvidenceBundle,
	collectExtendedEvidenceBundle,
	collectEvidenceBundle,
	evidenceCompletePath,
	evidenceDir,
	finalizeEvidenceBundleComplete,
	formatGateSummary,
	gateRecordPath,
	loadGateRecord,
};

/**
 * @param {string} projectRoot
 * @param {object} gate
 */
export function saveGateRecord(projectRoot, gate) {
	const filePath = gateRecordPath(projectRoot, gate.batchId);
	writeJsonAtomic(filePath, gate);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 */
export function openIntegrateGate(ctx) {
	const { projectRoot, batchId, batchState = null, config = null } = ctx;
	const existing = loadGateRecord(projectRoot, batchId);
	if (existing) {
		return { gate: existing, opened: false, evidenceRefs: existing.evidenceRefs ?? [] };
	}

	const targetRevision = resolveGateTargetRevision(projectRoot, batchState);
	const reconciliation = reconcileBatch({ projectRoot, batchState, verbose: true });
	const core = collectCoreEvidenceBundle({ projectRoot, batchId, batchState, config, reconciliation });
	/** @type {string[]} */
	let evidenceRefs = [...core.evidenceRefs];
	// Stamp category only — do not auto-approve; locked posture until SP-632 config opt-in.
	const category = resolveIntegrateGateCategory(config);

	const gate = {
		gateId: crypto.randomUUID(),
		batchId,
		kind: "integrate",
		category,
		status: "pending",
		openedAt: new Date().toISOString(),
		targetRevision,
		evidenceRefs,
		summary: formatGateSummary({ kind: "integrate", status: "pending", evidenceRefs }),
	};

	saveGateRecord(projectRoot, gate);
	appendJournalEvent(projectRoot, batchId, "gate.opened", {
		gateId: gate.gateId,
		kind: gate.kind,
		category: gate.category,
		status: gate.status,
		evidenceRefs: gate.evidenceRefs,
	});

	appendJournalEvent(projectRoot, batchId, "gate.evidence_collecting", {
		stage: "extended",
	});

	/** @type {string | null} */
	let extendedError = null;
	try {
		const extended = collectExtendedEvidenceBundle({
			projectRoot,
			batchId,
			batchState,
			config,
			evidenceRefs,
		});
		evidenceRefs = extended.evidenceRefs;
		appendJournalEvent(projectRoot, batchId, "gate.evidence_completed", {
			evidenceRefCount: evidenceRefs.length,
		});
	} catch (err) {
		extendedError = err instanceof Error ? err.message : String(err);
		appendJournalEvent(projectRoot, batchId, "gate.evidence_failed", {
			message: extendedError.slice(0, 500),
		});
	}

	gate.evidenceRefs = evidenceRefs;
	gate.summary = formatGateSummary({ kind: "integrate", status: "pending", evidenceRefs: gate.evidenceRefs });
	saveGateRecord(projectRoot, gate);

	if (!extendedError) {
		finalizeEvidenceBundleComplete(projectRoot, batchId, evidenceRefs);
	}

	return { gate, opened: true, evidenceRefs: gate.evidenceRefs, extendedError };
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
 * Remove a gate record so a fresh gate can be opened (SP-740 / #275).
 * Supported counterpart to hand-deleting `gate.json` (runbook §5.2 pre-v2.18).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {boolean} true when an existing record was removed
 */
export function removeGateRecord(projectRoot, batchId) {
	const filePath = gateRecordPath(projectRoot, batchId);
	if (!fs.existsSync(filePath)) return false;
	fs.rmSync(filePath, { force: true });
	return true;
}

/**
 * Re-open the integrate gate for a completed batch (SP-740 / #275).
 *
 * After `stale_revision` (orch tip drift past the approved pin) or a removed gate
 * record, completed-phase batches had no working re-open path: `spine batch resume
 * --force` refuses phase=completed. Reopening removes the stale/decided record and
 * routes through `openIntegrateGateAfterBatchComplete`, re-pinning `targetRevision`
 * to the current orch tip and re-collecting evidence for a fresh approval.
 *
 * Fail-closed guarantees preserved: a gate that is approved or pending AND still
 * pinned to the current orch tip is never invalidated here — approve/integrate
 * instead. Only missing, stale-pin, or rejected records are replaced.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @returns {{ ok: boolean, exitCode: number, reopened: boolean, reason: string, gate: object|null, headline: string, suggestedCommand: string, alternatives: string[], error?: string, extendedError?: string|null }}
 */
export function reopenIntegrateGateForCompletedBatch(ctx) {
	const { projectRoot, batchId, batchState = null } = ctx;
	const state = batchState ?? loadBatchStateFile(projectRoot).raw ?? null;

	if (String(state?.phase ?? "") !== "completed") {
		return {
			ok: false,
			exitCode: 1,
			reopened: false,
			reason: "batch_not_completed",
			gate: null,
			headline: "Gate reopen requires a completed batch",
			suggestedCommand: "spine status --diagnose",
			alternatives: [],
			error: `Batch ${batchId} is in phase ${String(state?.phase ?? "unknown")} — gate reopen only applies to completed batches`,
		};
	}

	if (!state?.orchBranch) {
		return {
			ok: false,
			exitCode: 1,
			reopened: false,
			reason: "no_orch_branch",
			gate: null,
			headline: "Gate reopen blocked — batch state has no orch branch",
			suggestedCommand: "spine status --diagnose",
			alternatives: [],
			error: "batchState.orchBranch missing; cannot pin a fresh targetRevision",
		};
	}

	const existing = loadGateRecord(projectRoot, batchId);
	if (existing && (existing.status === "approved" || existing.status === "pending")) {
		const pinCheck = validateGateTargetRevision(projectRoot, existing, state);
		if (pinCheck.ok) {
			const approved = String(existing.status) === "approved";
			return {
				ok: true,
				exitCode: 0,
				reopened: false,
				reason: approved ? "gate_current" : "gate_pending",
				gate: existing,
				headline: approved
					? "Gate already approved and pinned to the current orch tip — nothing to reopen"
					: "Gate already pending with a current pin — approve the existing record",
				suggestedCommand: approved ? "spine integrate" : "spine gate approve",
				alternatives: ["spine gate status"],
			};
		}
	}

	// Missing, stale-pin, or rejected record: clear the way and re-open with a fresh pin.
	removeGateRecord(projectRoot, batchId);
	appendJournalEvent(projectRoot, batchId, "gate.reopened", {
		previousStatus: existing?.status ?? null,
		previousTargetRevision: existing?.targetRevision ?? null,
		source: "spine gate reopen",
	});

	const gateResult = openIntegrateGateAfterBatchComplete({
		projectRoot,
		batchId,
		batchState: { ...state, phase: "completed" },
	});

	if (gateResult.skipped) {
		return {
			ok: false,
			exitCode: 1,
			reopened: false,
			reason: gateResult.reason ?? "gate_open_skipped",
			gate: null,
			headline: "Gate reopen failed — integrate gate could not be opened",
			suggestedCommand: "spine status --diagnose",
			alternatives: [],
			error: gateResult.reason ?? "openIntegrateGateAfterBatchComplete skipped",
		};
	}

	return {
		ok: true,
		exitCode: 0,
		reopened: true,
		reason: "reopened",
		gate: gateResult.gate,
		extendedError: gateResult.extendedError ?? null,
		headline: `Integrate gate re-opened — ${formatGateSummary(gateResult.gate)}; targetRevision re-pinned to current orch tip`,
		suggestedCommand: "spine gate approve",
		alternatives: ["spine gate status", "/spine-gate approve"],
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
		// SP-740 / #275: agree with `spine integrate` — a completed batch without a
		// gate record has a working re-open path; non-completed batches keep the
		// diagnose suggestion.
		const completed =
			String(loadBatchStateFile(projectRoot).raw?.phase ?? "") === "completed";
		return {
			ok: true,
			exitCode: 0,
			gate: null,
			headline: completed
				? "No integrate gate on record — batch completed; re-open and re-approve"
				: "No integrate gate on record",
			suggestedCommand: completed ? "spine gate reopen" : "spine status --diagnose",
			alternatives: completed
				? ["spine batch resume --force", "spine status --diagnose"]
				: [],
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
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {object|null} [ctx.batchState]
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
			const error = "Force integrate requires SPINE_ALLOW_FORCE=1";
			return {
				ok: false,
				required: true,
				exitCode: 2,
				failureClass: "GateBlocked",
				error,
				headline: "Force integrate blocked — set SPINE_ALLOW_FORCE=1 to bypass gate",
				suggestedCommand: "spine gate approve",
				blockers: [makeBlocker("force_integrate_blocked", error)],
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
		// SP-740 / #275: for completed batches point at the working re-open path so
		// integrate and `spine gate status` agree. Blocker code / exitCode unchanged —
		// automation switches on `missing_gate`, not display text.
		const completed =
			String((ctx.batchState ?? loadBatchStateFile(projectRoot).raw)?.phase ?? "") === "completed";
		const error = completed
			? "Integrate gate not opened — re-open and re-approve the completed batch before merging"
			: "Integrate gate not opened — approve evidence before merging";
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error,
			headline: completed
				? "Integrate blocked — no gate record (batch completed: spine gate reopen to re-open and re-approve)"
				: "Integrate blocked — no gate record (run batch to completion or spine gate status)",
			suggestedCommand: completed ? "spine gate reopen" : "spine gate status",
			alternatives: completed ? ["spine gate status", "/spine-gate"] : ["/spine-gate"],
			blockers: [makeBlocker("missing_gate", error)],
		};
	}

	if (gate.status === "approved") {
		const batchState = ctx.batchState ?? loadBatchStateFile(projectRoot).raw ?? null;
		const revisionCheck = validateGateTargetRevision(projectRoot, gate, batchState);
		if (!revisionCheck.ok) {
			const error = revisionCheck.error;
			return {
				ok: false,
				required: true,
				exitCode: 2,
				failureClass: "GateBlocked",
				error,
				headline: "Integrate blocked — gate targetRevision stale; re-open and re-approve",
				suggestedCommand: "spine gate status",
				gate,
				alternatives: ["/spine-gate status"],
				pinnedRevision: revisionCheck.pinnedRevision,
				currentRevision: revisionCheck.currentRevision,
				blockers: [makeBlocker("stale_revision", error)],
			};
		}
		return { ok: true, required: true, gate };
	}

	if (gate.status === "rejected") {
		const error = gate.rejectionReason ?? "Integrate gate was rejected";
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error,
			headline: "Integrate blocked — gate rejected",
			suggestedCommand: "spine gate status",
			gate,
			alternatives: ["/spine-gate status"],
			blockers: [makeBlocker("gate_rejected", error)],
		};
	}

	const pendingError = "Integrate gate pending human approval";
	return {
		ok: false,
		required: true,
		exitCode: 2,
		failureClass: "GateBlocked",
		error: pendingError,
		headline: "Integrate blocked — gate pending approval",
		suggestedCommand: "spine gate approve",
		gate,
		alternatives: ["/spine-gate approve", "spine gate reject"],
		blockers: [makeBlocker("gate_pending", pendingError)],
	};
}
