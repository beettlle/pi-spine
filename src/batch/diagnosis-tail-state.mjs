// @ts-nocheck
/**
 * Running diagnosis headlines when batch phase is active but no workers are scheduled (GitHub #68).
 */
import { isRunningWithoutActiveWorkers } from "../dashboard/running-tail-state.mjs";
import { macroPhaseLabel } from "./macro-phase.mjs";

export { isRunningWithoutActiveWorkers };

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @returns {string|null}
 */
export function buildRunningTailHeadline(batchLabel, ctx = {}) {
	if (!isRunningWithoutActiveWorkers(ctx)) {
		return null;
	}

	const macroPhase = ctx.macroPhase ?? null;

	if (ctx.postMergeLimbo || macroPhase === "gating") {
		if (ctx.integrateGateOpen) {
			return `${batchLabel} gate opened — approve to continue land loop`;
		}
		if (ctx.stalePathSpine) {
			return `${batchLabel} merged but gate not opened — use node bin/spine.mjs batch resume --attached (PATH spine may be stale)`;
		}
		return `${batchLabel} finalizing land loop — opening integrate gate…`;
	}

	if (macroPhase === "integrating") {
		return `${batchLabel} integrating orch branch to main…`;
	}

	if (macroPhase === "merging" || ctx.phase === "merging") {
		return `${batchLabel} tasks done — merging lane branches…`;
	}

	if (macroPhase === "reviewing") {
		return `${batchLabel} running reviews — no workers scheduled`;
	}

	if (macroPhase === "planning") {
		return `${batchLabel} planning — no workers scheduled`;
	}

	if (macroPhase != null && macroPhase !== "executing") {
		const label = macroPhaseLabel(macroPhase);
		return `${batchLabel} ${label.toLowerCase()} — finalizing batch`;
	}

	if (ctx.gitMerged === false || ctx.allTasksTerminalSuccess === true) {
		return `${batchLabel} tasks done — merging lane branches…`;
	}

	return `${batchLabel} finalizing batch — no active workers`;
}
