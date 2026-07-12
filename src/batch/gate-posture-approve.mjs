// @ts-nocheck
/**
 * Integrate gate approve / reject / posture auto-approve (SP-632 / FR-REL250-10 / #123).
 * Kept separate from gate.mjs so the open/check facade stays ≤500 LOC.
 */

import { resolveGatePostureConfig } from "../config/gate-posture-config.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { makeBlocker } from "./blocker-codes.mjs";
import { GATE_CATEGORIES, POSTURES } from "./gate-posture-defaults.mjs";
import { evaluateGatePosture } from "./gate-posture-evaluate.mjs";
import {
	getCategoryStreak,
	incrementCategoryStreak,
	incrementKindStreak,
	resetCategoryStreak,
	resetKindStreak,
} from "./gate-posture-streak.mjs";
import { gateRecordPath, loadGateRecord } from "./gate-evidence-read.mjs";
import { appendJournalEvent } from "./journal.mjs";

/** @typedef {import("./gate-posture-defaults.mjs").GateCategory} GateCategory */
/** @typedef {import("./gate-posture-evaluate.mjs").GatePostureEvaluateResult} GatePostureEvaluateResult */

/** Fail-closed integrate default — mirrors DEFAULT_INTEGRATE_GATE_CATEGORY in gate.mjs. */
const INTEGRATE_DEFAULT_CATEGORY = /** @type {GateCategory} */ ("execute");

const CATEGORY_SET = new Set(/** @type {string[]} */ ([...GATE_CATEGORIES]));

/**
 * @param {string} projectRoot
 * @param {object} gate
 */
function saveGateRecord(projectRoot, gate) {
	writeJsonAtomic(gateRecordPath(projectRoot, gate.batchId), gate);
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
	return INTEGRATE_DEFAULT_CATEGORY;
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
