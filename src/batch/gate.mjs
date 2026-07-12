// @ts-nocheck
/**
 * Integrate gate FSM and persistence (PRD §12, FR-GATE, FR-INT-02).
 */

import crypto from "node:crypto";
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
import { evaluateGatePosture } from "./gate-posture-evaluate.mjs";
import { GATE_CATEGORIES, POSTURES } from "./gate-posture-defaults.mjs";
import {
	getCategoryStreak,
	incrementCategoryStreak,
	incrementKindStreak,
	resetCategoryStreak,
	resetKindStreak,
} from "./gate-posture-streak.mjs";
import { resolveGateTargetRevision, validateGateTargetRevision } from "./gate-revision.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { reconcileBatch } from "./reconcile.mjs";

/** @typedef {import("./gate-posture-defaults.mjs").GateCategory} GateCategory */
/** @typedef {import("./gate-posture-evaluate.mjs").GatePostureEvaluateResult} GatePostureEvaluateResult */

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

/**
 * True when config explicitly overlays a posture for this category.
 * Integrate auto-approve requires opt-in — bare DEFAULT_POSTURES must not unlock.
 *
 * @param {unknown} config
 * @param {string} category
 * @returns {boolean}
 */
export function hasExplicitCategoryPostureOptIn(config, category) {
	if (!config || typeof config !== "object" || Array.isArray(config)) {
		return false;
	}
	const gates = /** @type {{ postures?: unknown }} */ (config).gates;
	if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
		return false;
	}
	const postures = gates.postures;
	if (!postures || typeof postures !== "object" || Array.isArray(postures)) {
		return false;
	}
	if (typeof category !== "string" || category.trim() === "" || category === "alwaysBreakOn") {
		return false;
	}
	if (!(category in postures)) {
		return false;
	}
	const entry = /** @type {Record<string, unknown>} */ (postures)[category];
	return typeof entry === "object" && entry !== null && !Array.isArray(entry);
}

/**
 * Resolve category stamped on a gate, failing closed to the integrate default.
 *
 * @param {object|null|undefined} gate
 * @returns {GateCategory}
 */
function resolveGateCategory(gate) {
	const raw = gate && typeof gate === "object" ? gate.category : null;
	if (typeof raw === "string" && CATEGORY_SET.has(raw)) {
		return /** @type {GateCategory} */ (raw);
	}
	return DEFAULT_INTEGRATE_GATE_CATEGORY;
}

/**
 * Persist consecutive-approval streak after a successful approve.
 * Failures must not undo the gate FSM decision.
 *
 * @param {string} projectRoot
 * @param {object} gate
 */
function recordApprovalStreak(projectRoot, gate) {
	const category = resolveGateCategory(gate);
	try {
		incrementCategoryStreak(projectRoot, category);
		if (typeof gate.kind === "string" && gate.kind.trim() !== "") {
			incrementKindStreak(projectRoot, gate.kind);
		}
	} catch {
		// Streak I/O must not reverse an already-persisted approval.
	}
}

/**
 * Reset streak counters after a reject (breaks consecutive-approval chain).
 *
 * @param {string} projectRoot
 * @param {object} gate
 */
function recordRejectStreakReset(projectRoot, gate) {
	const category = resolveGateCategory(gate);
	try {
		resetCategoryStreak(projectRoot, category);
		if (typeof gate.kind === "string" && gate.kind.trim() !== "") {
			resetKindStreak(projectRoot, gate.kind);
		}
	} catch {
		// Streak reset failure must not reverse a persisted rejection.
	}
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
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {"human" | "auto"} [ctx.decidedBy]
 * @param {GatePostureEvaluateResult | null} [ctx.postureEvaluation]
 */
export function approveIntegrateGate(ctx) {
	const { projectRoot, batchId, decidedBy = "human", postureEvaluation = null } = ctx;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		const error = "No integrate gate found for this batch";
		return {
			ok: false,
			exitCode: 1,
			error,
			headline: "Cannot approve — gate not opened",
			suggestedCommand: "spine status --diagnose",
			blockers: [makeBlocker("missing_gate", error)],
		};
	}

	if (gate.status === "approved") {
		return { ok: true, exitCode: 0, gate, headline: "Integrate gate already approved", alreadyDecided: true };
	}

	if (gate.status === "rejected") {
		const error = "Gate was rejected — reopen batch evidence or start a new gate cycle";
		return {
			ok: false,
			exitCode: 1,
			error,
			headline: "Cannot approve a rejected gate",
			suggestedCommand: "spine gate status",
			gate,
			blockers: [makeBlocker("gate_rejected", error)],
		};
	}

	const actor = decidedBy === "auto" ? "auto" : "human";
	gate.status = "approved";
	gate.decidedAt = new Date().toISOString();
	gate.decidedBy = actor;
	saveGateRecord(projectRoot, gate);
	recordApprovalStreak(projectRoot, gate);

	/** @type {Record<string, unknown>} */
	const journalPayload = {
		gateId: gate.gateId,
		kind: gate.kind,
		category: gate.category ?? null,
		status: gate.status,
		decidedBy: actor,
	};
	if (postureEvaluation) {
		journalPayload.postureDecision = postureEvaluation.decision;
		journalPayload.postureReason = postureEvaluation.reason;
		journalPayload.postureTier = postureEvaluation.tier;
	}

	appendJournalEvent(projectRoot, batchId, "gate.approved", journalPayload);

	return {
		ok: true,
		exitCode: 0,
		gate,
		headline: actor === "auto" ? "Integrate gate auto-approved" : "Integrate gate approved",
		suggestedCommand: "spine integrate",
		alternatives: ["/spine-integrate"],
		decidedBy: actor,
	};
}

/**
 * Evaluate posture and auto-approve a pending integrate gate when config opts in.
 * Default (no explicit `gates.postures[category]`) stays locked — never auto.
 * Does not bypass `validateSequenceAutoApproveGate` for the blunt CLI flag path.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {readonly string[]} [ctx.tags]
 */
export function maybeAutoApproveIntegrateGate(ctx) {
	const { projectRoot, batchId, tags = [] } = ctx;
	const config = ctx.config ?? loadSpineConfig(projectRoot).config ?? null;
	const gate = loadGateRecord(projectRoot, batchId);

	if (!gate) {
		return { ok: true, approved: false, skipped: true, reason: "no_gate" };
	}
	if (gate.status === "approved") {
		return { ok: true, approved: false, skipped: true, reason: "already_approved", gate };
	}
	if (gate.status === "rejected") {
		return { ok: true, approved: false, skipped: true, reason: "rejected", gate };
	}
	if (gate.status !== "pending") {
		return { ok: true, approved: false, skipped: true, reason: "not_pending", gate };
	}

	const category = resolveGateCategory(gate);
	const optedIn = hasExplicitCategoryPostureOptIn(config, category);
	const postureConfig = resolveGatePostureConfig(config);
	const categoryEntry = optedIn
		? postureConfig.categories[category]
		: { posture: POSTURES.LOCKED, autoApproveAfterN: null };

	const consecutiveApprovals = getCategoryStreak(projectRoot, category);
	/** @type {string[]} */
	const mergedTags = [];
	if (Array.isArray(gate.tags)) {
		for (const tag of gate.tags) {
			if (typeof tag === "string") mergedTags.push(tag);
		}
	}
	for (const tag of tags) {
		if (typeof tag === "string") mergedTags.push(tag);
	}

	const evaluation = evaluateGatePosture({
		category,
		posture: categoryEntry.posture,
		autoApproveAfterN: categoryEntry.autoApproveAfterN,
		consecutiveApprovals,
		tags: mergedTags,
		alwaysBreakOn: postureConfig.alwaysBreakOn,
	});

	if (evaluation.decision !== "allow-auto") {
		return {
			ok: true,
			approved: false,
			evaluation,
			optedIn,
			category,
			consecutiveApprovals,
			reason: evaluation.reason,
			gate,
		};
	}

	const approved = approveIntegrateGate({
		projectRoot,
		batchId,
		decidedBy: "auto",
		postureEvaluation: evaluation,
	});

	return {
		ok: approved.ok,
		exitCode: approved.exitCode,
		approved: approved.ok === true,
		evaluation,
		optedIn,
		category,
		decidedBy: "auto",
		gate: approved.gate ?? gate,
		headline: approved.headline,
		error: approved.error,
		blockers: approved.blockers,
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
	recordRejectStreakReset(projectRoot, gate);

	appendJournalEvent(projectRoot, batchId, "gate.rejected", {
		gateId: gate.gateId,
		kind: gate.kind,
		category: gate.category ?? null,
		status: gate.status,
		reason: reason ?? null,
		decidedBy: "human",
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
		const error = "Integrate gate not opened — approve evidence before merging";
		return {
			ok: false,
			required: true,
			exitCode: 2,
			failureClass: "GateBlocked",
			error,
			headline: "Integrate blocked — no gate record (run batch to completion or spine gate status)",
			suggestedCommand: "spine gate status",
			alternatives: ["/spine-gate"],
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
