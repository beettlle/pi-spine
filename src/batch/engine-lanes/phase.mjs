/**
 * Batch phase transition helpers for the engine-lanes facade.
 * Leaf module: journals phase changes without importing resume/limbo/reconcile.
 */

import { appendJournalEvent } from "../journal.mjs";

/**
 * @param {string} fromPhase
 * @param {string} toPhase
 */
function phaseTransitionEventType(fromPhase, toPhase) {
	if (fromPhase === "planning" && toPhase === "running") return "batch.started";
	if (toPhase === "completed") return "batch.completed";
	if (toPhase === "failed") return "batch.failed";
	if (toPhase === "aborted") return "batch.aborted";
	return null;
}

/**
 * @param {{ projectRoot: string, batchId: string, fromPhase: string, toPhase: string, extra?: Record<string, unknown> }} params
 */
function recordPhaseTransition({ projectRoot, batchId, fromPhase, toPhase, extra = {} }) {
	const type = phaseTransitionEventType(fromPhase, toPhase);
	if (!type) return;
	appendJournalEvent(projectRoot, batchId, type, {
		fromPhase,
		toPhase,
		...extra,
	});
}

/**
 * Mutate `state.phase` and journal the transition (SP-770).
 *
 * @param {Record<string, any>} state Batch state mutated in place.
 * @param {string} newPhase
 * @param {{ projectRoot: string, batchId: string, extra?: Record<string, unknown> }} ctx
 */
export function transitionPhase(state, newPhase, ctx) {
	const fromPhase = state.phase;
	if (fromPhase === newPhase) return;
	state.phase = newPhase;
	recordPhaseTransition({
		projectRoot: ctx.projectRoot,
		batchId: ctx.batchId,
		fromPhase,
		toPhase: newPhase,
		...ctx.extra,
	});
}
