// @ts-nocheck
/**
 * Batch macro-phase derivation (Phase 41 — operator lifecycle label).
 *
 * Maps reconciliation signals to a stable macro-phase enum distinct from
 * diagnosis (actionable) and lane activityPhase (per-lane detail).
 *
 * Mapping table (priority top → bottom; first match wins):
 *
 * | Macro phase  | Signals |
 * |--------------|---------|
 * | idle         | diagnosis null/undefined (no active batch) |
 * | aborted      | batchPhase or diagnosis `aborted` |
 * | failed       | batchPhase `failed`, or terminal-failure diagnoses when not recoverable drift/orphan (#165) |
 * | paused       | batchPhase or diagnosis `paused` (when not failed) |
 * | gating       | integrate gate record `pending`, or postMergeLimbo awaiting operator gate approval |
 * | integrating  | open `integrate.started` journal event, or diagnosis `needs_integrate` |
 * | completed    | batchPhase `completed` without integrate pending, or diagnosis `completed` / `completed_manual` / `limbo_stale` |
 * | merging      | batchPhase `merging`, or diagnosis `needs_merge` |
 * | reviewing    | open `review.started` without matching `review.completed` / `review.failed` |
 * | planning     | batchPhase `planning` |
 * | executing    | default for active batch (running diagnosis, running/executing phase) |
 */

/** @typedef {(typeof MACRO_PHASES)[number]} MacroPhase */

export const MACRO_PHASES = /** @type {const} */ ([
	"idle",
	"planning",
	"executing",
	"merging",
	"reviewing",
	"gating",
	"integrating",
	"completed",
	"failed",
	"aborted",
	"paused",
]);

/** @type {Record<MacroPhase, string>} */
export const MACRO_PHASE_LABELS = {
	idle: "Idle",
	planning: "Planning",
	executing: "Executing",
	merging: "Merging",
	reviewing: "Reviewing",
	gating: "Gating",
	integrating: "Integrating",
	completed: "Completed",
	failed: "Failed",
	aborted: "Aborted",
	paused: "Paused",
};

const COMPLETED_DIAGNOSES = new Set(["completed", "completed_manual", "limbo_stale"]);

const FAILED_DIAGNOSES = new Set([
	"failed",
	"needs_retry",
	"worker_orphaned",
	"engine_orphaned",
	"state_drift",
	"worker_done_missing",
	"needs_replan",
	"git_unavailable",
]);

/** Drift/orphan diagnoses that may still be progressing while batch phase is active (#165). */
const RECOVERABLE_DRIFT_ORPHAN_DIAGNOSES = new Set([
	"state_drift",
	"engine_orphaned",
	"worker_orphaned",
]);

const ACTIVE_BATCH_PHASES = new Set(["running", "merging"]);

const INTEGRATE_EVENT_TYPES = new Set(["integrate.started", "integrate.completed", "integrate.failed"]);

/**
 * @param {string|null|undefined} phase
 * @returns {phase is MacroPhase}
 */
export function isMacroPhase(phase) {
	return MACRO_PHASES.includes(/** @type {MacroPhase} */ (phase));
}

/**
 * @param {MacroPhase} phase
 * @returns {string}
 */
export function macroPhaseLabel(phase) {
	return MACRO_PHASE_LABELS[phase] ?? String(phase);
}

/**
 * @param {object} event
 * @returns {string|null}
 */
function journalEventTaskId(event) {
	if (typeof event.taskId === "string" && event.taskId) return event.taskId;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	return typeof payload.taskId === "string" ? payload.taskId : null;
}

/**
 * @param {object[]} journalEvents
 * @returns {boolean}
 */
function hasOpenReview(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;

	/** @type {Map<string, { taskId: string, reviewType: string, stepNumber: unknown }>} */
	const openReviews = new Map();

	for (const event of journalEvents) {
		if (event.type === "review.started") {
			const taskId = journalEventTaskId(event);
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			const reviewType = payload.reviewType;
			if (!taskId || typeof reviewType !== "string") continue;
			const key = `${taskId}:${reviewType}:${String(payload.stepNumber ?? "")}`;
			openReviews.set(key, { taskId, reviewType, stepNumber: payload.stepNumber });
			continue;
		}

		if (event.type !== "review.completed" && event.type !== "review.failed") continue;

		const taskId = journalEventTaskId(event);
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const reviewType = payload.reviewType;
		if (!taskId || typeof reviewType !== "string") continue;
		const key = `${taskId}:${reviewType}:${String(payload.stepNumber ?? "")}`;
		openReviews.delete(key);
	}

	return openReviews.size > 0;
}

/**
 * @param {object[]} journalEvents
 * @returns {boolean}
 */
function hasOpenIntegrate(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;

	let lastIntegrateIdx = -1;
	let lastIntegrateType = null;

	for (let index = 0; index < journalEvents.length; index += 1) {
		const type = journalEvents[index]?.type;
		if (typeof type === "string" && INTEGRATE_EVENT_TYPES.has(type)) {
			lastIntegrateIdx = index;
			lastIntegrateType = type;
		}
	}

	return lastIntegrateIdx >= 0 && lastIntegrateType === "integrate.started";
}

const MERGE_JOURNAL_TYPES = new Set([
	"batch.merge_started",
	"batch.merge_completed",
	"batch.merge_blocked",
]);

const LAND_LOOP_JOURNAL_TYPES = new Set([
	"gate.opened",
	"gate.evidence_collecting",
	"gate.evidence_completed",
	"batch.land_loop_finalized",
]);

/**
 * @param {object[]} journalEvents
 * @returns {boolean}
 */
function hasJournalMergeActivity(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;
	return journalEvents.some((event) => MERGE_JOURNAL_TYPES.has(event.type));
}

/**
 * @param {object[]} journalEvents
 * @returns {boolean}
 */
function hasJournalLandLoopActivity(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;
	return journalEvents.some((event) => LAND_LOOP_JOURNAL_TYPES.has(event.type));
}

/**
 * @param {object|null|undefined} gateRecord
 * @param {boolean} postMergeLimbo
 * @param {string|null|undefined} diagnosis
 * @returns {boolean}
 */
function isGatingState(gateRecord, postMergeLimbo, diagnosis) {
	if (gateRecord && gateRecord.status === "pending") return true;
	if (postMergeLimbo && diagnosis === "needs_integrate") return true;
	if (postMergeLimbo && diagnosis === "running") return true;
	return false;
}

/**
 * Drift/orphan under an active batch may still be executing, merging, or gating — not macro Failed.
 *
 * @param {DeriveMacroPhaseInput} input
 * @returns {boolean}
 */
function isRecoverableDriftOrphanWhileActive(input) {
	const diagnosis = input.diagnosis ?? null;
	const batchPhase = input.batchPhase ?? null;
	if (diagnosis == null || !RECOVERABLE_DRIFT_ORPHAN_DIAGNOSES.has(diagnosis)) {
		return false;
	}
	if (!ACTIVE_BATCH_PHASES.has(batchPhase ?? "")) {
		return false;
	}
	if (input.hasActiveWorkerTasks === true) {
		return true;
	}
	// All lanes terminal — defer to gating/integrating/merging tail derivation.
	if (input.allTasksTerminalSuccess === true) {
		return true;
	}
	return false;
}

/**
 * @param {DeriveMacroPhaseInput} input
 * @returns {MacroPhase|null}
 */
function deriveRunningTailMacroPhase(input) {
	const diagnosis = input.diagnosis ?? null;
	const batchPhase = input.batchPhase ?? null;
	if (diagnosis !== "running") return null;
	if (batchPhase !== "running" && batchPhase !== "merging") return null;
	if (input.hasActiveWorkerTasks === true) return null;

	const journalEvents = input.journalEvents ?? [];
	if (hasJournalLandLoopActivity(journalEvents)) {
		return "gating";
	}

	const mergeResults = input.mergeResults;
	if (Array.isArray(mergeResults) && mergeResults.length > 0) {
		return "merging";
	}

	if (hasJournalMergeActivity(journalEvents)) {
		return "merging";
	}

	if (input.postMergeLimbo === true) {
		return "gating";
	}

	if (input.allTasksTerminalSuccess === true && input.mergeResultsEmpty !== false) {
		return "merging";
	}

	return null;
}

/**
 * @typedef {object} DeriveMacroPhaseInput
 * @property {string|null|undefined} diagnosis
 * @property {string|null|undefined} batchPhase
 * @property {number|null|undefined} [currentWaveIndex]
 * @property {unknown[]} [mergeResults]
 * @property {object|null|undefined} [gateRecord]
 * @property {boolean} [postMergeLimbo]
 * @property {object[]} [journalEvents]
 * @property {boolean} [hasActiveWorkerTasks]
 * @property {boolean} [allTasksTerminalSuccess]
 * @property {boolean} [mergeResultsEmpty]
 */

/**
 * @param {DeriveMacroPhaseInput} input
 * @returns {MacroPhase}
 */
export function deriveMacroPhase(input) {
	const diagnosis = input.diagnosis ?? null;
	const batchPhase = input.batchPhase ?? null;
	const postMergeLimbo = input.postMergeLimbo === true;
	const journalEvents = input.journalEvents ?? [];
	const gateRecord = input.gateRecord ?? null;

	if (diagnosis == null && batchPhase == null) {
		return "idle";
	}

	if (batchPhase === "aborted" || diagnosis === "aborted") {
		return "aborted";
	}

	if (
		batchPhase === "failed" ||
		batchPhase === "merge_blocked" ||
		(diagnosis != null && FAILED_DIAGNOSES.has(diagnosis) && !isRecoverableDriftOrphanWhileActive(input))
	) {
		return "failed";
	}

	if (batchPhase === "paused" || diagnosis === "paused") {
		return "paused";
	}

	if (isGatingState(gateRecord, postMergeLimbo, diagnosis)) {
		return "gating";
	}

	if (hasOpenIntegrate(journalEvents) || diagnosis === "needs_integrate") {
		return "integrating";
	}

	if (batchPhase === "completed" || (diagnosis != null && COMPLETED_DIAGNOSES.has(diagnosis))) {
		return "completed";
	}

	if (batchPhase === "merging" || diagnosis === "needs_merge") {
		return "merging";
	}

	if (hasOpenReview(journalEvents)) {
		return "reviewing";
	}

	if (batchPhase === "planning") {
		return "planning";
	}

	const runningTailPhase = deriveRunningTailMacroPhase(input);
	if (runningTailPhase != null) {
		return runningTailPhase;
	}

	return "executing";
}
