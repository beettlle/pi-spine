// @ts-nocheck
/**
 * Integrate gate approve / reject / posture auto-approve (SP-632 / FR-REL250-10 / #123).
 * Kept separate from gate.mjs so the open/check facade stays ≤500 LOC.
 */

import fs from "node:fs";
import { resolveGatePostureConfig } from "../config/gate-posture-config.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { makeBlocker } from "./blocker-codes.mjs";
import { GATE_CATEGORIES, POSTURES } from "./gate-posture-defaults.mjs";
import { evaluateGatePosture } from "./gate-posture-evaluate.mjs";
import {
	gatePostureStreakPath,
	getCategoryStreak,
	incrementCategoryStreak,
	incrementKindStreak,
	resetCategoryStreak,
	resetKindStreak,
} from "./gate-posture-streak.mjs";
import { gateRecordPath, loadGateRecord } from "./gate-evidence-read.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";

/** @typedef {import("./gate-posture-defaults.mjs").GateCategory} GateCategory */
/** @typedef {import("./gate-posture-evaluate.mjs").GatePostureEvaluateResult} GatePostureEvaluateResult */

/** Fail-closed integrate default — mirrors DEFAULT_INTEGRATE_GATE_CATEGORY in gate.mjs. */
const INTEGRATE_DEFAULT_CATEGORY = /** @type {GateCategory} */ ("execute");

const CATEGORY_SET = new Set(/** @type {string[]} */ ([...GATE_CATEGORIES]));

/**
 * Real streak I/O operations (SP-824). Tests may override any subset via
 * `ctx.streakIo` to inject failures; production always uses these.
 */
const DEFAULT_STREAK_IO = Object.freeze({
	incrementCategoryStreak,
	incrementKindStreak,
	resetCategoryStreak,
	resetKindStreak,
	/**
	 * @param {string} projectRoot
	 */
	removeStreakFile(projectRoot) {
		fs.rmSync(gatePostureStreakPath(projectRoot), { force: true });
	},
});

/**
 * @param {unknown} streakIo Optional partial override of streak I/O operations.
 * @returns {typeof DEFAULT_STREAK_IO}
 */
function resolveStreakIo(streakIo) {
	if (!streakIo || typeof streakIo !== "object" || Array.isArray(streakIo)) {
		return DEFAULT_STREAK_IO;
	}
	return { ...DEFAULT_STREAK_IO, ...streakIo };
}

/**
 * Best-effort journal record of a streak I/O failure (SP-824 / #314).
 * A journal write failure here must never throw out of an already-persisted
 * approve/reject flow, so the append itself is guarded.
 *
 * @param {string} projectRoot
 * @param {string|null|undefined} batchId
 * @param {Record<string, unknown>} payload
 */
function journalStreakIoFailure(projectRoot, batchId, payload) {
	if (typeof batchId !== "string" || batchId.trim() === "") return;
	try {
		appendJournalEvent(projectRoot, batchId, "gate.streak_io_failed", payload);
	} catch {
		// Journaling is best-effort — never reverse the persisted gate decision.
	}
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * SP-824 / #314 — does this batch's journal record a `gate.streak_io_failed`
 * event for a reset whose fail-closed recovery (streak file removal) also
 * failed? If so the consecutive-approval state is untrustworthy.
 * A journal read failure itself counts as unreliable (fail closed).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {boolean}
 */
function journalHasUnrecoveredStreakReset(projectRoot, batchId) {
	/** @type {object[]} */
	let events;
	try {
		events = readJournalEvents(projectRoot, batchId);
	} catch {
		return true;
	}
	return events.some((event) => {
		if (!event || typeof event !== "object" || event.type !== "gate.streak_io_failed") {
			return false;
		}
		const payload = event.payload;
		return (
			!!payload &&
			typeof payload === "object" &&
			!Array.isArray(payload) &&
			payload.op === "reset" &&
			payload.recovered === false
		);
	});
}

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
 * Failures must not undo the gate FSM decision; they are journaled instead
 * (SP-824 / #314). A failed increment only delays auto-approval — the safe
 * direction — so no recovery is attempted.
 *
 * @param {string} projectRoot
 * @param {object} gate
 * @param {string} batchId
 * @param {typeof DEFAULT_STREAK_IO} streakIo
 */
function recordApprovalStreak(projectRoot, gate, batchId, streakIo) {
	const category = resolveGateCategory(gate);
	try {
		streakIo.incrementCategoryStreak(projectRoot, category);
		if (typeof gate.kind === "string" && gate.kind.trim() !== "") {
			streakIo.incrementKindStreak(projectRoot, gate.kind);
		}
	} catch (error) {
		// Streak I/O must not reverse an already-persisted approval.
		journalStreakIoFailure(projectRoot, batchId, {
			op: "increment",
			category,
			kind: typeof gate.kind === "string" && gate.kind.trim() !== "" ? gate.kind : null,
			error: errorMessage(error),
		});
	}
}

/**
 * Reset streak counters after a reject (breaks consecutive-approval chain).
 * A failed reset would leave a stale consecutive-approval count that could
 * unlock a later auto-approve despite the rejection, so this fails closed:
 * best-effort removal of the whole streak store (missing file → zero counts).
 *
 * @param {string} projectRoot
 * @param {object} gate
 * @param {string} batchId
 * @param {typeof DEFAULT_STREAK_IO} streakIo
 */
function recordRejectStreakReset(projectRoot, gate, batchId, streakIo) {
	const category = resolveGateCategory(gate);
	try {
		streakIo.resetCategoryStreak(projectRoot, category);
		if (typeof gate.kind === "string" && gate.kind.trim() !== "") {
			streakIo.resetKindStreak(projectRoot, gate.kind);
		}
	} catch (error) {
		// Streak reset failure must not reverse a persisted rejection.
		let recovered = true;
		let recoveryError = null;
		try {
			streakIo.removeStreakFile(projectRoot);
		} catch (rmError) {
			recovered = false;
			recoveryError = errorMessage(rmError);
		}
		journalStreakIoFailure(projectRoot, batchId, {
			op: "reset",
			category,
			kind: typeof gate.kind === "string" && gate.kind.trim() !== "" ? gate.kind : null,
			error: errorMessage(error),
			recovered,
			...(recovered ? {} : { recoveryError }),
		});
	}
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {"human" | "auto"} [ctx.decidedBy]
 * @param {GatePostureEvaluateResult | null} [ctx.postureEvaluation]
 * @param {string} [ctx.synthesis] Optional operator readback note (SP-747 / #280); omitted stays absent.
 */
export function approveIntegrateGate(ctx) {
	const { projectRoot, batchId, decidedBy = "human", postureEvaluation = null, synthesis } = ctx;
	const streakIo = resolveStreakIo(ctx.streakIo);
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
	// SP-747 / #280: persist the operator's synthesis readback when provided.
	// Absent / empty flag leaves the field omitted (non-breaking null default);
	// auto-approve never passes synthesis, so automated records stay without one.
	const synthesisNote = typeof synthesis === "string" && synthesis.trim() !== "" ? synthesis : null;
	if (synthesisNote) gate.synthesis = synthesisNote;
	saveGateRecord(projectRoot, gate);
	recordApprovalStreak(projectRoot, gate, batchId, streakIo);

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
	if (synthesisNote) {
		journalPayload.synthesis = synthesisNote;
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
	const streakIo = resolveStreakIo(ctx.streakIo);
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

	// SP-824 / #314 fail-closed: a journal-recorded unrecovered streak reset means
	// the consecutive-approval state cannot be trusted — never auto-approve on it.
	// Checked before reading the streak so the unreliable state is never consumed.
	if (journalHasUnrecoveredStreakReset(projectRoot, batchId)) {
		return {
			ok: true,
			approved: false,
			evaluation: { decision: "require-manual", reason: "streak_unreliable", tier: null },
			optedIn,
			category,
			consecutiveApprovals: null,
			reason: "streak_unreliable",
			gate,
		};
	}

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
		streakIo,
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
 * @param {string} [ctx.synthesis] Optional operator readback note (SP-747 / #280).
 */
export function rejectIntegrateGate(ctx) {
	const { projectRoot, batchId, reason, synthesis } = ctx;
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
	// SP-747 / #280: same optional readback contract as approve — omit when absent.
	const synthesisNote = typeof synthesis === "string" && synthesis.trim() !== "" ? synthesis : null;
	if (synthesisNote) gate.synthesis = synthesisNote;
	saveGateRecord(projectRoot, gate);
	const streakIo = resolveStreakIo(ctx.streakIo);
	recordRejectStreakReset(projectRoot, gate, batchId, streakIo);

	appendJournalEvent(projectRoot, batchId, "gate.rejected", {
		gateId: gate.gateId,
		kind: gate.kind,
		category: gate.category ?? null,
		status: gate.status,
		reason: reason ?? null,
		...(synthesisNote ? { synthesis: synthesisNote } : {}),
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
